"""Bake the town residents' VRoid avatars: recolour and shrink them.

Reads `scripts/vrm-recipes.json` (resident id -> {base, hair, skin, clothes}) and,
for every recipe, turns the base avatar `.assets-try/vroid/<base>.vrm` into
`public/vrm/<id>.vrm`: textures recoloured for that resident, resized and
re-encoded as WebP, morph targets nobody uses dropped, the BIN rebuilt with only
what is still referenced. The result stays a VRM 0.x file (humanoid, spring
bones, MToon properties and the kept expressions untouched).

The base avatars are pixiv's VRoid samples, kept outside git in
`.assets-try/vroid`: the nine "beta" samples declare CC0 in their own meta;
AvatarSample_A/B/C allow commercial use and redistribution on their VRoid Hub
pages.

Usage:
  python scripts/vrm-bake.py                 bake every recipe
  python scripts/vrm-bake.py cafe school     bake those ids
  --check                                    re-parse and validate each output
  --sheet <out.png>                          contact sheet of face / hair / tops

Standard library + Pillow only.
"""

import io
import json
import os
import struct
import sys

from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECIPES = os.path.join(ROOT, "scripts", "vrm-recipes.json")
SRC_DIR = os.path.join(ROOT, ".assets-try", "vroid")
OUT_DIR = os.path.join(ROOT, "public", "vrm")

KEEP_PRESETS = {
    "neutral", "a", "i", "u", "e", "o", "blink", "blink_l", "blink_r",
    "joy", "angry", "sorrow", "fun", "lookup", "lookdown", "lookleft", "lookright",
}
KEEP_NAMES = {"surprised"}

# Materials whose images may stay up to 1024 px (faces are seen up close).
FACE_KEYS = ("EyeIris", "Face_00_SKIN", "FaceMouth", "FaceEyeline", "FaceEyelash",
             "EyeHighlight", "EyeWhite", "EyeExtra", "FaceBrow")
MAX_SIDE = 512
MAX_SIDE_FACE = 1024

# Texture slots that carry colour (may be recoloured); every other slot
# (normal maps, matcap, rim, emission, outline width...) must never be.
COLOUR_SLOTS = ("_MainTex", "_ShadeTexture")

SHADE_SKIN = [1.0, 0.86, 0.82]
SHADE_OTHER = [0.82, 0.80, 0.84]

COMPONENT_SIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
TYPE_COUNT = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}

GLB_MAGIC = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942


# ---------------------------------------------------------------- GLB io

def read_glb(path):
    data = open(path, "rb").read()
    magic, version, length = struct.unpack_from("<III", data, 0)
    if magic != GLB_MAGIC or version != 2:
        raise ValueError(f"{path}: not a glTF 2 binary")
    off = 12
    gltf, binary = None, b""
    while off < length:
        clen, ctype = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == CHUNK_JSON:
            gltf = json.loads(chunk.decode("utf-8"))
        elif ctype == CHUNK_BIN:
            binary = chunk
        off += 8 + clen
    return gltf, binary, len(data), length


def write_glb(path, gltf, binary):
    js = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    binary = bytes(binary) + b"\0" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", GLB_MAGIC, 2, total))
        f.write(struct.pack("<II", len(js), CHUNK_JSON))
        f.write(js)
        f.write(struct.pack("<II", len(binary), CHUNK_BIN))
        f.write(binary)
    return total


def view_bytes(gltf, binary, bv_index):
    bv = gltf["bufferViews"][bv_index]
    start = bv.get("byteOffset", 0)
    return binary[start: start + bv["byteLength"]]


# ---------------------------------------------------------------- colour helpers

def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def opaque_mask(alpha):
    """255 where the pixel is fully opaque; falls back to any alpha if none is."""
    m = alpha.point(lambda a: 255 if a == 255 else 0)
    if m.getbbox() is None:
        m = alpha.point(lambda a: 255 if a > 0 else 0)
    return m


def hist_percentile(hist, q):
    total = sum(hist)
    if total == 0:
        return None
    goal = total * q
    acc = 0
    for v, n in enumerate(hist):
        acc += n
        if acc >= goal:
            return v
    return 255


def skin_base_colour(img):
    """Median colour of the opaque, reasonably bright pixels of a skin image."""
    rgba = img.convert("RGBA")
    r, g, b, a = rgba.split()
    lum = rgba.convert("L")
    mask = ImageChops.multiply(opaque_mask(a), lum.point(lambda v: 255 if v >= 100 else 0))
    if mask.getbbox() is None:
        mask = opaque_mask(a)
    out = []
    for ch in (r, g, b):
        v = hist_percentile(ch.histogram(mask=mask), 0.5)
        out.append(max(1, v if v is not None else 200))
    return tuple(out)


def recolour_multiply(img, factors):
    rgba = img.convert("RGBA")
    r, g, b, a = rgba.split()
    chans = [ch.point(lambda v, f=f: min(255, int(round(v * f)))) for ch, f in zip((r, g, b), factors)]
    return Image.merge("RGBA", chans + [a])


def recolour_luma(img, target, keep=0.0):
    """Luminance-preserving recolour towards `target`; `keep` = share of the original kept."""
    rgba = img.convert("RGBA")
    r, g, b, a = rgba.split()
    lum = rgba.convert("L")
    lref = hist_percentile(lum.histogram(mask=opaque_mask(a)), 0.85) or 255
    lref = max(lref, 1)
    chans = []
    for t in target:
        table = [min(255, int(round(t * min(l / lref, 1.35)))) for l in range(256)]
        chans.append(lum.point(table))
    out = Image.merge("RGBA", chans + [a])
    if keep > 0:
        out = Image.blend(out, rgba, keep)
        out.putalpha(a)
    return out


def encode_webp(img):
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    buf = io.BytesIO()
    if alpha.getextrema()[0] < 255:
        rgba.save(buf, "WEBP", quality=84, method=6, exact=True)
    else:
        rgba.convert("RGB").save(buf, "WEBP", quality=84, method=6)
    return buf.getvalue()


# ---------------------------------------------------------------- texture plan

def material_texture_uses(gltf):
    """Per material index: list of (slot, texture index)."""
    vrm_props = gltf.get("extensions", {}).get("VRM", {}).get("materialProperties", [])
    by_name = {p.get("name"): p for p in vrm_props}
    uses = []
    for i, mat in enumerate(gltf.get("materials", [])):
        u = []
        pbr = mat.get("pbrMetallicRoughness", {})
        if "baseColorTexture" in pbr:
            u.append(("baseColor", pbr["baseColorTexture"]["index"]))
        for key, slot in (("normalTexture", "_BumpMap"), ("emissiveTexture", "_EmissionMap"),
                          ("occlusionTexture", "occlusion")):
            if key in mat:
                u.append((slot, mat[key]["index"]))
        prop = vrm_props[i] if i < len(vrm_props) and vrm_props[i].get("name") == mat.get("name") \
            else by_name.get(mat.get("name"))
        if prop:
            for slot, tex in prop.get("textureProperties", {}).items():
                u.append((slot, tex))
        uses.append(u)
    return uses


def material_class(name, recipe):
    """('skin'|'hair'|'brow'|'clothes', clothes keyword or None) or None."""
    if name.endswith("_SKIN"):
        return ("skin", None)
    if "_HAIR" in name:
        return ("hair", None)
    if "FaceBrow" in name:
        return ("brow", None)
    for kw in recipe.get("clothes", {}):
        if kw.lower() in name.lower():
            return ("clothes", kw)
    return None


CLASS_PRIORITY = {"skin": 0, "hair": 1, "brow": 1, "clothes": 2}


def plan_images(gltf, recipe):
    """Decide, per image, its recolour class and its maximum side."""
    mats = gltf.get("materials", [])
    textures = gltf.get("textures", [])
    uses = material_texture_uses(gltf)
    claim = {}          # image -> (priority, class, keyword, material name)
    non_colour = {}     # image -> a material/slot that uses it as non-colour
    face_image = set()
    for mi, mat in enumerate(mats):
        name = mat.get("name", "")
        cls = material_class(name, recipe)
        is_face = any(k in name for k in FACE_KEYS)
        for slot, ti in uses[mi]:
            if ti is None or ti >= len(textures) or "source" not in textures[ti]:
                continue
            img = textures[ti]["source"]
            if is_face:
                face_image.add(img)
            if slot in ("baseColor",) + COLOUR_SLOTS:
                if cls:
                    pri = CLASS_PRIORITY[cls[0]]
                    if img not in claim or pri < claim[img][0]:
                        claim[img] = (pri, cls[0], cls[1], name)
            else:
                non_colour.setdefault(img, f"{name}.{slot}")
    warnings = []
    for img in list(claim):
        if img in non_colour:
            warnings.append(f"image {img} is colour for {claim[img][3]} but also {non_colour[img]}: not recoloured")
            del claim[img]
    return claim, face_image, warnings


# ---------------------------------------------------------------- morph pruning

def prune_morphs(gltf):
    vrm = gltf["extensions"]["VRM"]
    groups = vrm.get("blendShapeMaster", {}).get("blendShapeGroups", [])
    kept_groups = [g for g in groups
                   if (g.get("presetName") or "").lower() in KEEP_PRESETS
                   or (g.get("name") or "").lower() in KEEP_NAMES]
    vrm["blendShapeMaster"]["blendShapeGroups"] = kept_groups
    used = {}
    for g in kept_groups:
        for bind in g.get("binds", []):
            used.setdefault(bind["mesh"], set()).add(bind["index"])
    kept_total = dropped_total = 0
    remap = {}
    for mi, mesh in enumerate(gltf["meshes"]):
        n = max((len(p.get("targets", [])) for p in mesh["primitives"]), default=0)
        if n == 0:
            continue
        keep = sorted(i for i in used.get(mi, set()) if i < n)
        remap[mi] = {old: new for new, old in enumerate(keep)}
        kept_total += len(keep)
        dropped_total += n - len(keep)

        def pick(lst):
            return [lst[i] for i in keep]

        for prim in mesh["primitives"]:
            if "targets" in prim:
                prim["targets"] = [{"POSITION": t["POSITION"]} for t in pick(prim["targets"])]
                if not prim["targets"]:
                    del prim["targets"]
            ex = prim.get("extras")
            if ex and isinstance(ex.get("targetNames"), list) and len(ex["targetNames"]) == n:
                ex["targetNames"] = pick(ex["targetNames"])
        if isinstance(mesh.get("weights"), list) and len(mesh["weights"]) == n:
            mesh["weights"] = pick(mesh["weights"])
            if not mesh["weights"]:
                del mesh["weights"]
        ex = mesh.get("extras")
        if ex and isinstance(ex.get("targetNames"), list) and len(ex["targetNames"]) == n:
            ex["targetNames"] = pick(ex["targetNames"])
    for g in kept_groups:
        for bind in g.get("binds", []):
            bind["index"] = remap[bind["mesh"]][bind["index"]]
    return kept_total, dropped_total, len(groups) - len(kept_groups)


# ---------------------------------------------------------------- BIN rebuild

def rebuild(gltf, binary, new_images):
    """Keep only referenced accessors / bufferViews; `new_images` = image index -> bytes."""
    used_acc = []
    seen = {}

    def acc(i):
        if i not in seen:
            seen[i] = len(used_acc)
            used_acc.append(i)
        return seen[i]

    for mesh in gltf["meshes"]:
        for prim in mesh["primitives"]:
            prim["attributes"] = {k: acc(v) for k, v in prim["attributes"].items()}
            if "indices" in prim:
                prim["indices"] = acc(prim["indices"])
            if "targets" in prim:
                prim["targets"] = [{k: acc(v) for k, v in t.items()} for t in prim["targets"]]
    for skin in gltf.get("skins", []):
        if "inverseBindMatrices" in skin:
            skin["inverseBindMatrices"] = acc(skin["inverseBindMatrices"])
    for anim in gltf.get("animations", []):
        for s in anim.get("samplers", []):
            s["input"] = acc(s["input"])
            s["output"] = acc(s["output"])

    old_accessors = gltf["accessors"]
    old_views = gltf["bufferViews"]
    out = bytearray()
    views = []

    def add_view(old_bv, data):
        while len(out) % 4:
            out.append(0)
        bv = {k: v for k, v in old_bv.items() if k not in ("byteOffset", "byteLength", "buffer")}
        bv["buffer"] = 0
        bv["byteOffset"] = len(out)
        bv["byteLength"] = len(data)
        out.extend(data)
        views.append(bv)
        return len(views) - 1

    view_map = {}

    def view(i):
        if i not in view_map:
            view_map[i] = add_view(old_views[i], view_bytes(gltf, binary, i))
        return view_map[i]

    accessors = []
    for i in used_acc:
        a = dict(old_accessors[i])
        if "bufferView" in a:
            a["bufferView"] = view(a["bufferView"])
        if "sparse" in a:
            sp = json.loads(json.dumps(a["sparse"]))
            sp["indices"]["bufferView"] = view(sp["indices"]["bufferView"])
            sp["values"]["bufferView"] = view(sp["values"]["bufferView"])
            a["sparse"] = sp
        accessors.append(a)
    for ii, img in enumerate(gltf.get("images", [])):
        if "bufferView" in img:
            data = new_images.get(ii)
            if data is None:
                img["bufferView"] = view(img["bufferView"])
            else:
                img["bufferView"] = add_view({}, data)
    gltf["accessors"] = accessors
    gltf["bufferViews"] = views
    while len(out) % 4:
        out.append(0)
    gltf["buffers"] = [{k: v for k, v in gltf["buffers"][0].items() if k != "uri"}]
    gltf["buffers"][0]["byteLength"] = len(out)
    return bytes(out)


# ---------------------------------------------------------------- bake

def bake(rid, recipe):
    src = os.path.join(SRC_DIR, recipe["base"] + ".vrm")
    gltf, binary, in_size, _ = read_glb(src)
    if len(gltf.get("buffers", [])) != 1:
        raise ValueError(f"{src}: expected one buffer")
    notes = []

    # Recipe keywords that match no material.
    names = [m.get("name", "") for m in gltf.get("materials", [])]
    for kw in recipe.get("clothes", {}):
        if not any(kw.lower() in n.lower() for n in names):
            notes.append(f"clothes keyword '{kw}' matches no material")

    claim, face_images, warns = plan_images(gltf, recipe)
    notes += warns

    # Skin factors from the face skin image (body uses the same).
    skin_target = hex_rgb(recipe["skin"])
    face_img = body_img = None
    textures = gltf["textures"]
    uses = material_texture_uses(gltf)
    for mi, n in enumerate(names):
        for slot, ti in uses[mi]:
            if slot in ("baseColor", "_MainTex") and ti < len(textures):
                if n.endswith("Face_00_SKIN") and face_img is None:
                    face_img = textures[ti]["source"]
                if n.endswith("Body_00_SKIN") and body_img is None:
                    body_img = textures[ti]["source"]
    ref_img = face_img if face_img is not None else body_img
    if face_img is None:
        notes.append("no Face_00_SKIN image; skin base taken from the body")

    def load(ii):
        im = gltf["images"][ii]
        return Image.open(io.BytesIO(view_bytes(gltf, binary, im["bufferView"])))

    factors = (1.0, 1.0, 1.0)
    if ref_img is not None:
        base = skin_base_colour(load(ref_img))
        factors = tuple(t / b for t, b in zip(skin_target, base))

    hair = hex_rgb(recipe["hair"])
    brow = tuple(int(round(c * 0.75)) for c in hair)
    new_images = {}
    for ii, im in enumerate(gltf.get("images", [])):
        if "bufferView" not in im:
            continue
        img = load(ii)
        img.load()
        img = img.convert("RGBA")
        limit = MAX_SIDE_FACE if ii in face_images else MAX_SIDE
        if max(img.size) > limit:
            s = limit / max(img.size)
            img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
        c = claim.get(ii)
        if c:
            cls, kw = c[1], c[2]
            if cls == "skin":
                img = recolour_multiply(img, factors)
            elif cls == "hair":
                img = recolour_luma(img, hair)
            elif cls == "brow":
                img = recolour_luma(img, brow)
            elif cls == "clothes":
                img = recolour_luma(img, hex_rgb(recipe["clothes"][kw]), keep=0.2)
        new_images[ii] = encode_webp(img)
        im["mimeType"] = "image/webp"

    # Shade colours of the recoloured materials.
    props = gltf["extensions"]["VRM"].get("materialProperties", [])
    for p in props:
        cls = material_class(p.get("name", ""), recipe)
        if not cls or cls[0] == "brow":
            continue
        vec = p.setdefault("vectorProperties", {})
        old = vec.get("_ShadeColor", [1, 1, 1, 1])
        alpha = old[3] if len(old) > 3 else 1
        vec["_ShadeColor"] = (SHADE_SKIN if cls[0] == "skin" else SHADE_OTHER) + [alpha]

    kept, dropped, groups_dropped = prune_morphs(gltf)
    new_bin = rebuild(gltf, binary, new_images)
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, rid + ".vrm")
    out_size = write_glb(out, gltf, new_bin)
    print(f"{rid:8s} {recipe['base']:18s} {in_size / 1e6:6.2f} MB -> {out_size / 1e6:5.2f} MB  "
          f"images {len(new_images):2d}  morphs kept {kept} dropped {dropped} (groups dropped {groups_dropped})")
    for n in notes:
        print(f"         note: {n}")
    return out, in_size, out_size, notes


# ---------------------------------------------------------------- check

def check(path):
    gltf, binary, file_size, header_len = read_glb(path)
    errs = []
    if header_len != file_size:
        errs.append(f"header length {header_len} != file size {file_size}")
    buf_len = gltf["buffers"][0]["byteLength"]
    if buf_len > len(binary):
        errs.append("buffer longer than BIN chunk")
    for i, bv in enumerate(gltf["bufferViews"]):
        if bv.get("byteOffset", 0) + bv["byteLength"] > buf_len:
            errs.append(f"bufferView {i} past buffer")
        if bv.get("byteOffset", 0) % 4:
            errs.append(f"bufferView {i} not 4-aligned")
    for i, a in enumerate(gltf["accessors"]):
        if "bufferView" not in a:
            continue
        bv = gltf["bufferViews"][a["bufferView"]]
        elem = COMPONENT_SIZE[a["componentType"]] * TYPE_COUNT[a["type"]]
        stride = bv.get("byteStride", elem)
        need = a.get("byteOffset", 0) + (stride * (a["count"] - 1) + elem if a["count"] else 0)
        if need > bv["byteLength"]:
            errs.append(f"accessor {i} overruns bufferView {a['bufferView']}")
    for i, im in enumerate(gltf.get("images", [])):
        if "bufferView" not in im:
            continue
        try:
            pic = Image.open(io.BytesIO(view_bytes(gltf, binary, im["bufferView"])))
            pic.load()
            if pic.format != "WEBP" or im.get("mimeType") != "image/webp":
                errs.append(f"image {i} is not WebP")
        except Exception as e:  # noqa: BLE001
            errs.append(f"image {i} does not decode: {e}")
    counts = []
    for mi, mesh in enumerate(gltf["meshes"]):
        ns = {len(p.get("targets", [])) for p in mesh["primitives"]}
        if len(ns) > 1:
            errs.append(f"mesh {mi} primitives disagree on target count {ns}")
        counts.append(max(ns) if ns else 0)
        for p in mesh["primitives"]:
            for t in p.get("targets", []):
                if set(t) != {"POSITION"}:
                    errs.append(f"mesh {mi} target has {sorted(t)}")
    for g in gltf["extensions"]["VRM"]["blendShapeMaster"]["blendShapeGroups"]:
        for b in g.get("binds", []):
            if b["index"] >= counts[b["mesh"]]:
                errs.append(f"group {g['name']} bind {b['index']} >= {counts[b['mesh']]}")
    return errs


# ---------------------------------------------------------------- sheet

def sheet(ids, out_path):
    from PIL import ImageDraw
    th, pad, label_w = 160, 8, 90
    rows = []
    for rid in ids:
        path = os.path.join(OUT_DIR, rid + ".vrm")
        if not os.path.exists(path):
            continue
        gltf, binary, _, _ = read_glb(path)
        uses = material_texture_uses(gltf)
        pick = {"face": None, "hair": None, "tops": None}
        for mi, mat in enumerate(gltf["materials"]):
            n = mat.get("name", "")
            src = next((gltf["textures"][ti]["source"] for slot, ti in uses[mi] if slot in ("baseColor", "_MainTex")), None)
            if src is None:
                continue
            if n.endswith("Face_00_SKIN") and pick["face"] is None:
                pick["face"] = src
            elif "_HAIR" in n and pick["hair"] is None:
                pick["hair"] = src
            elif "tops" in n.lower() and pick["tops"] is None:
                pick["tops"] = src
        thumbs = []
        for key in ("face", "hair", "tops"):
            ii = pick[key]
            if ii is None:
                thumbs.append(None)
                continue
            img = Image.open(io.BytesIO(view_bytes(gltf, binary, gltf["images"][ii]["bufferView"]))).convert("RGBA")
            img.thumbnail((th, th), Image.LANCZOS)
            thumbs.append(img)
        rows.append((rid, thumbs))
    w = label_w + 3 * (th + pad) + pad
    h = len(rows) * (th + pad) + pad
    canvas = Image.new("RGB", (w, h), (128, 128, 128))
    draw = ImageDraw.Draw(canvas)
    for r, (rid, thumbs) in enumerate(rows):
        y = pad + r * (th + pad)
        draw.text((pad, y + th // 2 - 6), rid, fill=(255, 255, 255))
        for c, img in enumerate(thumbs):
            x = label_w + c * (th + pad)
            if img is None:
                draw.rectangle([x, y, x + th - 1, y + th - 1], outline=(90, 90, 90))
                continue
            canvas.paste(img, (x, y), img)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    canvas.save(out_path)
    print(f"sheet: {out_path} ({len(rows)} rows: face skin, hair, tops)")


# ---------------------------------------------------------------- main

def main(argv):
    do_check = "--check" in argv
    sheet_out = None
    ids = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--sheet":
            sheet_out = argv[i + 1]
            i += 2
            continue
        if not a.startswith("--"):
            ids.append(a)
        i += 1
    recipes = json.load(open(RECIPES, encoding="utf-8"))
    ids = ids or list(recipes)
    unknown = [r for r in ids if r not in recipes]
    if unknown:
        sys.exit(f"unknown ids: {', '.join(unknown)}")
    tin = tout = 0
    bad = 0
    for rid in ids:
        path, isz, osz, _ = bake(rid, recipes[rid])
        tin += isz
        tout += osz
        if do_check:
            errs = check(path)
            print(f"         check: {'OK' if not errs else str(len(errs)) + ' problems'}")
            for e in errs[:20]:
                print(f"           {e}")
            bad += bool(errs)
    print(f"total {len(ids)} files: {tin / 1e6:.1f} MB -> {tout / 1e6:.1f} MB"
          + (f"; check failed for {bad}" if bad else ("; all checks OK" if do_check else "")))
    if sheet_out:
        sheet(ids, sheet_out)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
