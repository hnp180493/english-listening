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
MAX_SIDE = 256
MAX_SIDE_FACE = 512

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


def recolour_luma(img, target, keep=0.0, lift=0.0):
    """Luminance-preserving recolour towards `target`; `keep` = share of the original kept.

    `lift` (0..1) is a floor under the darkest pixels: black cloth recoloured to blue has to come out blue, not
    black (the first bake left a navy uniform black). "auto" picks it from how dark the image is.
    """
    rgba = img.convert("RGBA")
    r, g, b, a = rgba.split()
    lum = rgba.convert("L")
    hist = lum.histogram(mask=opaque_mask(a))
    lref = hist_percentile(hist, 0.85) or 255
    lref = max(lref, 1)
    if lift == "auto":
        med = hist_percentile(hist, 0.5) or 0
        # mostly dark cloth: a strong floor; mixed (a white shirt under a dark vest): a milder one
        lift = 0.62 if lref < 90 else (0.5 if med < 70 else (0.3 if med < 130 else 0.12))
    chans = []
    for t in target:
        table = [min(255, int(round(t * (lift + (1.0 - lift) * min(l / lref, 1.35))))) for l in range(256)]
        chans.append(lum.point(table))
    out = Image.merge("RGBA", chans + [a])
    if keep > 0:
        out = Image.blend(out, rgba, keep)
        out.putalpha(a)
    return out


def recolour_duo(img, dark, light):
    """
    Two colours on one image by how light it is (recipe clothes value [dark, light]): a sample's dark vest over a
    white shirt drawn together (Sakurada_Fumiriya) becomes Ben's green apron over a cream shirt, Daniel's mustard
    sweater over a white one. Each part keeps its own folds.
    """
    rgba = img.convert("RGBA")
    lum = rgba.convert("L")
    a = rgba.getchannel("A")
    d = recolour_luma(rgba, dark, keep=0.0, lift=0.55)
    l = recolour_luma(rgba, light, keep=0.0, lift=0.35)
    # (the split: the vest is dark, the shirt light; a soft edge between)
    mask = lum.point(lambda v: max(0, min(255, int((v - 95) * 255 / 60))))
    out = Image.composite(l, d, mask)
    out.putalpha(a)
    return out


def encode_webp(img):
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    buf = io.BytesIO()
    if alpha.getextrema()[0] < 255:
        rgba.save(buf, "WEBP", quality=84, method=4, exact=True)
    else:
        rgba.convert("RGB").save(buf, "WEBP", quality=84, method=4)
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
    if "EyeIris" in name and recipe.get("eyes"):
        return ("eyes", None)
    for kw in recipe.get("clothes", {}):
        if kw.lower() in name.lower():
            return ("clothes", kw)
    return None


CLASS_PRIORITY = {"skin": 0, "hair": 1, "brow": 1, "eyes": 1, "clothes": 2}


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


# ---------------------------------------------------------------- older people (recipe "slacks", "eyes")

# Where a VRoid body's legs are on its skin texture (the same template on every F00 sample): the lower halves of the
# two side columns, from the top of the thigh (v 0.49) down to the ankle (v 1). Read off the samples' textures:
# Victoria_Rubin's stockings and Vivi's painted boots lie there.
LEG_U = (0.236, 0.762)
LEG_V = 0.49


def _acc_array(gltf, binary, ai):
    """An accessor's values as a flat list (floats or ints), and its number of components."""
    a = gltf["accessors"][ai]
    bv = gltf["bufferViews"][a["bufferView"]]
    n = TYPE_COUNT[a["type"]]
    size = COMPONENT_SIZE[a["componentType"]]
    code = {5126: "f", 5125: "I", 5123: "H", 5121: "B"}[a["componentType"]]
    stride = bv.get("byteStride", n * size)
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    out = []
    for i in range(a["count"]):
        o = start + i * stride
        out.extend(struct.unpack_from("<" + code * n, binary, o))
    return out, n


def _append(gltf, binary, data):
    """A new bufferView at the end of the BIN; returns (binary, view index)."""
    pad = (4 - len(binary) % 4) % 4
    binary = bytes(binary) + b"\0" * pad
    gltf["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)})
    return binary + data, len(gltf["bufferViews"]) - 1


def _leg_uv(u, v):
    return (u < LEG_U[0] or u > LEG_U[1]) and v > LEG_V


def apply_slacks(gltf, binary, recipe, notes):
    """
    Long trousers for an older body (owner, 2026-11-27, on Grace: "mặc đồ xì tin quá"). Every female sample wears a
    short skirt over bare legs, socks or tights; the legs are part of the body's skin. The body's leg triangles (by
    their place on the skin texture) become a mesh of their own in a cloth material named for the "Bottoms" (so it
    takes the bottoms' colour, here and when a tintable base is tinted at run time), a little wider than the leg and
    widening to the ankle like a pair of slacks, not tights. The sample's own short skirt, in the same colour, then
    reads as the top of the trousers. Returns the new BIN.
    """
    mats = gltf["materials"]
    bm = next((i for i, m in enumerate(mats) if m.get("name", "").endswith("Body_00_SKIN")), None)
    if bm is None:
        notes.append("slacks: no body skin material")
        return binary
    body_mat = mats[bm]
    body_tex = body_mat.get("pbrMetallicRoughness", {}).get("baseColorTexture", {}).get("index")
    if body_tex is None:
        notes.append("slacks: the body has no texture")
        return binary
    # the cloth's texture: light, nearly flat, a soft shading of the skin's own folds kept (tinted like any cloth)
    src_img = gltf["textures"][body_tex]["source"]
    img = Image.open(io.BytesIO(view_bytes(gltf, binary, gltf["images"][src_img]["bufferView"]))).convert("RGBA")
    lum = img.convert("L")
    from PIL import ImageFilter
    blur = lum.filter(ImageFilter.GaussianBlur(radius=max(2, img.width // 64)))
    detail = ImageChops.subtract(lum, blur, scale=1.0, offset=128)
    cloth = detail.point(lambda d: max(0, min(255, int(round(228 + (d - 128) * 0.35)))))
    cloth_img = Image.merge("RGBA", (cloth, cloth, cloth, Image.new("L", img.size, 255)))
    buf = io.BytesIO()
    cloth_img.save(buf, "PNG")
    binary, img_view = _append(gltf, binary, buf.getvalue())
    gltf["images"].append({"name": "Slacks", "bufferView": img_view, "mimeType": "image/png"})
    tex = dict(gltf["textures"][body_tex])
    tex["source"] = len(gltf["images"]) - 1
    gltf["textures"].append(tex)
    new_tex = len(gltf["textures"]) - 1
    # the material: a copy of the body's, named as bottoms
    prefix = body_mat["name"].split("_Body_")[0]
    name = prefix + "_Slacks_Bottoms_01_CLOTH"
    mat = json.loads(json.dumps(body_mat))
    mat["name"] = name
    mat["pbrMetallicRoughness"]["baseColorTexture"] = {"index": new_tex}
    for k in ("normalTexture", "emissiveTexture", "occlusionTexture"):
        mat.pop(k, None)
    mats.append(mat)
    new_mat = len(mats) - 1
    props = gltf["extensions"]["VRM"].get("materialProperties", [])
    if len(props) == new_mat:
        bp = next((p for p in props if p.get("name") == body_mat["name"]), None)
        p = json.loads(json.dumps(bp)) if bp else {"shader": "VRM/MToon", "floatProperties": {}, "vectorProperties": {}, "textureProperties": {}, "keywordMap": {}, "tagMap": {}}
        p["name"] = name
        tp = p.setdefault("textureProperties", {})
        for k in list(tp):
            if k not in ("_MainTex", "_ShadeTexture"):
                del tp[k]
        tp["_MainTex"] = new_tex
        tp["_ShadeTexture"] = new_tex
        p.setdefault("keywordMap", {}).pop("_NORMALMAP", None)
        props.append(p)
    else:
        notes.append("slacks: material properties not aligned with materials")
    # split the body's primitives
    inflated = {}
    made = 0
    for mesh in gltf["meshes"]:
        extra = []
        for prim in mesh["primitives"]:
            if prim.get("material") != bm or "indices" not in prim:
                continue
            uv, _ = _acc_array(gltf, binary, prim["attributes"]["TEXCOORD_0"])
            idx, _ = _acc_array(gltf, binary, prim["indices"])
            keep, legs = [], []
            for t in range(0, len(idx), 3):
                tri = idx[t: t + 3]
                cu = sum(uv[2 * i] for i in tri) / 3
                cv = sum(uv[2 * i + 1] for i in tri) / 3
                (legs if _leg_uv(cu, cv) else keep).extend(tri)
            if not legs:
                continue
            pos_acc = prim["attributes"]["POSITION"]
            if pos_acc not in inflated:
                pos, _ = _acc_array(gltf, binary, pos_acc)
                nor, _ = _acc_array(gltf, binary, prim["attributes"]["NORMAL"])
                out = list(pos)
                done = set()
                for t in range(0, len(idx), 3):
                    tri = idx[t: t + 3]
                    cu = sum(uv[2 * i] for i in tri) / 3
                    cv = sum(uv[2 * i + 1] for i in tri) / 3
                    if not _leg_uv(cu, cv):
                        continue
                    for i in tri:
                        if i in done:
                            continue
                        done.add(i)
                        v = uv[2 * i + 1]
                        # nothing at the top of the thigh (it meets the body there, under the skirt), wider down to
                        # the ankle: about a centimetre and a half round the shin, two at the hem
                        k = max(0.0, min(1.0, (v - LEG_V) / 0.1))
                        d = k * (0.008 + 0.014 * max(0.0, min(1.0, (v - LEG_V) / (1 - LEG_V))))
                        for c in range(3):
                            out[3 * i + c] += nor[3 * i + c] * d
                data = struct.pack("<" + "f" * len(out), *out)
                binary, view = _append(gltf, binary, data)
                a = dict(gltf["accessors"][pos_acc])
                a.pop("byteOffset", None)
                a["bufferView"] = view
                a["min"] = [min(out[c::3]) for c in range(3)]
                a["max"] = [max(out[c::3]) for c in range(3)]
                gltf["accessors"].append(a)
                inflated[pos_acc] = len(gltf["accessors"]) - 1
            for part, target in ((keep, prim), (legs, None)):
                if not part:
                    continue
                data = struct.pack("<" + "I" * len(part), *part)
                binary, view = _append(gltf, binary, data)
                gltf["accessors"].append({"bufferView": view, "componentType": 5125, "count": len(part), "type": "SCALAR"})
                ai = len(gltf["accessors"]) - 1
                if target is not None:
                    target["indices"] = ai
                else:
                    np = json.loads(json.dumps(prim))
                    np["indices"] = ai
                    np["material"] = new_mat
                    np["attributes"]["POSITION"] = inflated[pos_acc]
                    extra.append(np)
            made += len(legs) // 3
        mesh["primitives"].extend(extra)
    if not made:
        notes.append("slacks: no leg triangles found")
    else:
        notes.append(f"slacks: {made} leg triangles")
    return binary


def _node_world(gltf):
    """Every node's rest position in the model (VRoid exports translations only: no rotation, no scale)."""
    par = {}
    for i, n in enumerate(gltf["nodes"]):
        for c in n.get("children", []):
            par[c] = i
    memo = {}

    def at(i):
        if i in memo:
            return memo[i]
        t = gltf["nodes"][i].get("translation", [0, 0, 0])
        p = par.get(i)
        w = list(t) if p is None else [a + b for a, b in zip(at(p), t)]
        memo[i] = w
        return w

    return at, par


def _pack(values, comp, kind):
    code = {5126: "f", 5125: "I", 5123: "H", 5121: "B"}[comp]
    data = struct.pack("<" + code * len(values), *values)
    return data


def apply_hair(gltf, binary, src_name, notes, keep_front=False):
    """
    Another sample's hair on this body (recipe "hair_from"; owner, 2026-11-27, "nhiều nhân vật ko map quá": Kim, a
    doctor with a black ponytail, wore the frilly dress that came with the only ponytail). The female samples share
    one head and skeleton, differently sized, and VRoid exports every bone with no rotation and no scale, so the hair
    moves over as data: its mesh (and the back of the head's hair cap, which VRoid puts on the body mesh), its bones
    under this head, its springs, its materials and images. Positions are taken from the source's head to this head
    and scaled by the two faces' sizes (per axis). This body's own hair is replaced (its bones stay, unused). Returns
    the new BIN.
    """
    sg, sbin, _, _ = read_glb(os.path.join(SRC_DIR, src_name + ".vrm"))
    s_at, s_par = _node_world(sg)
    t_at, _ = _node_world(gltf)
    s_name = {n["name"]: i for i, n in enumerate(sg["nodes"])}
    t_name = {n["name"]: i for i, n in enumerate(gltf["nodes"])}
    s_head, t_head = s_name["J_Bip_C_Head"], t_name["J_Bip_C_Head"]
    hs, ht = s_at(s_head), t_at(t_head)

    def face_box(g):
        a = g["accessors"][g["meshes"][g["nodes"][0]["mesh"]]["primitives"][0]["attributes"]["POSITION"]]
        return [mx - mn for mn, mx in zip(a["min"], a["max"])]

    fb_s, fb_t = face_box(sg), face_box(gltf)
    S = [t / s for t, s in zip(fb_t, fb_s)]

    def move(p):
        return [ht[k] + S[k] * (p[k] - hs[k]) for k in range(3)]

    # ── the hair's bones: every source node named HairJoint-…, under this head ──
    hair_src = [i for i, n in enumerate(sg["nodes"]) if n["name"].startswith("HairJoint-")]
    new_of = {}
    for i in hair_src:
        gltf["nodes"].append({"name": sg["nodes"][i]["name"]})
        new_of[i] = len(gltf["nodes"]) - 1
    for i in hair_src:
        p = s_par.get(i)
        parent = new_of[p] if p in new_of else t_name.get(sg["nodes"][p]["name"], t_head)
        pw = move(s_at(p)) if p in new_of else t_at(parent)
        me = move(s_at(i))
        gltf["nodes"][new_of[i]]["translation"] = [me[k] - pw[k] for k in range(3)]
        gltf["nodes"][parent].setdefault("children", []).append(new_of[i])

    # ── the skin: this hair mesh's skin, with the new bones added ──
    hair_node = next(n for n in gltf["nodes"] if n.get("name") == "Hair001")
    skin = gltf["skins"][hair_node["skin"]]
    ib, _ = _acc_array(gltf, binary, skin["inverseBindMatrices"])
    joints = list(skin["joints"])
    t_joint_of = {gltf["nodes"][j]["name"]: k for k, j in enumerate(joints)}
    for i in hair_src:
        t_joint_of[sg["nodes"][i]["name"]] = len(joints)
        joints.append(new_of[i])
        w = move(s_at(i))
        ib.extend([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -w[0], -w[1], -w[2], 1])
    binary, view = _append(gltf, binary, _pack(ib, 5126, "MAT4"))
    gltf["accessors"].append({"bufferView": view, "componentType": 5126, "count": len(joints), "type": "MAT4"})
    skin["inverseBindMatrices"] = len(gltf["accessors"]) - 1
    skin["joints"] = joints

    # ── the materials, textures and images of the hair ──
    mat_of = {}
    tex_of = {}
    s_props = sg["extensions"]["VRM"]["materialProperties"]
    t_props = gltf["extensions"]["VRM"]["materialProperties"]

    def copy_tex(ti):
        if ti in tex_of:
            return tex_of[ti]
        st = sg["textures"][ti]
        img = sg["images"][st["source"]]
        binary_l = view_bytes(sg, sbin, img["bufferView"])
        nonlocal binary
        binary, v = _append(gltf, binary, binary_l)
        gltf["images"].append({"name": img.get("name", "hair"), "bufferView": v, "mimeType": img.get("mimeType", "image/png")})
        nt = {"source": len(gltf["images"]) - 1}
        if "sampler" in st:
            gltf.setdefault("samplers", []).append(dict(sg["samplers"][st["sampler"]]))
            nt["sampler"] = len(gltf["samplers"]) - 1
        gltf["textures"].append(nt)
        tex_of[ti] = len(gltf["textures"]) - 1
        return tex_of[ti]

    def copy_mat(mi):
        if mi in mat_of:
            return mat_of[mi]
        m = json.loads(json.dumps(sg["materials"][mi]))
        pbr = m.get("pbrMetallicRoughness", {})
        if "baseColorTexture" in pbr:
            pbr["baseColorTexture"] = {"index": copy_tex(pbr["baseColorTexture"]["index"])}
        for k in ("normalTexture", "emissiveTexture", "occlusionTexture"):
            if k in m:
                m[k] = dict(m[k], index=copy_tex(m[k]["index"]))
        gltf["materials"].append(m)
        p = next((x for x in s_props if x.get("name") == m["name"]), None)
        p = json.loads(json.dumps(p)) if p else {"name": m["name"], "shader": "VRM_USE_GLTFSHADER"}
        p["textureProperties"] = {k: copy_tex(v) for k, v in p.get("textureProperties", {}).items()}
        t_props.append(p)
        mat_of[mi] = len(gltf["materials"]) - 1
        return mat_of[mi]

    # ── the primitives: the source hair mesh, and the hair cap on its body mesh ──
    s_joints = sg["skins"][sg["nodes"][s_name["Hair001"]]["skin"]]["joints"]
    remap = [t_joint_of.get(sg["nodes"][j]["name"], t_joint_of["J_Bip_C_Head"]) for j in s_joints]
    picks = list(sg["meshes"][sg["nodes"][s_name["Hair001"]]["mesh"]]["primitives"])
    for m in sg["meshes"]:
        for p in m["primitives"]:
            if "HairBack" in sg["materials"][p["material"]]["name"]:
                picks.append(p)
    prims = []
    for p in picks:
        idx, _ = _acc_array(sg, sbin, p["indices"])
        used = sorted(set(idx))
        local = {v: k for k, v in enumerate(used)}
        attrs = {}
        for key, ai in p["attributes"].items():
            if key not in ("POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0"):
                continue
            vals, n = _acc_array(sg, sbin, ai)
            a = sg["accessors"][ai]
            out = []
            for v in used:
                x = vals[v * n:(v + 1) * n]
                if key == "POSITION":
                    x = move(x)
                elif key == "JOINTS_0":
                    x = [remap[j] for j in x]
                out.extend(x)
            comp = 5123 if key == "JOINTS_0" else a["componentType"]
            binary, view = _append(gltf, binary, _pack(out, comp, a["type"]))
            acc = {"bufferView": view, "componentType": comp, "count": len(used), "type": a["type"]}
            if a.get("normalized"):
                acc["normalized"] = True
            if key == "POSITION":
                acc["min"] = [min(out[c::3]) for c in range(3)]
                acc["max"] = [max(out[c::3]) for c in range(3)]
            gltf["accessors"].append(acc)
            attrs[key] = len(gltf["accessors"]) - 1
        new_idx = [local[v] for v in idx]
        binary, view = _append(gltf, binary, _pack(new_idx, 5125, "SCALAR"))
        gltf["accessors"].append({"bufferView": view, "componentType": 5125, "count": len(new_idx), "type": "SCALAR"})
        prims.append({"attributes": attrs, "indices": len(gltf["accessors"]) - 1, "material": copy_mat(p["material"]), "mode": p.get("mode", 4)})
    if keep_front:
        # this body's own fringe kept (its parting), the source's dropped: a lock is the fringe when it hangs in front
        # of the head (the model faces -z)
        def centroid_z(g, b_, p):
            pos, _ = _acc_array(g, b_, p["attributes"]["POSITION"])
            idx, _ = _acc_array(g, b_, p["indices"])
            used = set(idx)
            return sum(pos[3 * v + 2] for v in used) / max(1, len(used))

        front = ht[2] - 0.035
        mine = [p for p in gltf["meshes"][hair_node["mesh"]]["primitives"] if centroid_z(gltf, binary, p) < front]
        prims = [p for p in prims if centroid_z(gltf, binary, p) >= front] + mine
    gltf["meshes"][hair_node["mesh"]]["primitives"] = prims

    # ── the springs: this body's hair springs out, the source's in (its colliders matched by bone) ──
    sa_t = gltf["extensions"]["VRM"]["secondaryAnimation"]
    sa_s = sg["extensions"]["VRM"]["secondaryAnimation"]
    t_hair = {i for i, n in enumerate(gltf["nodes"]) if n.get("name", "").startswith("HairJoint-")} - set(new_of.values())
    if not keep_front:
        sa_t["boneGroups"] = [bg for bg in sa_t["boneGroups"] if not any(b in t_hair for b in bg.get("bones", []))]
    t_cg = {gltf["nodes"][c["node"]]["name"]: k for k, c in enumerate(sa_t["colliderGroups"])}
    k_mean = sum(S) / 3
    moved = 0
    for bg in sa_s["boneGroups"]:
        if not bg.get("bones") or not all(b in new_of for b in bg["bones"]):
            continue
        nb = json.loads(json.dumps(bg))
        nb["bones"] = [new_of[b] for b in bg["bones"]]
        nb["colliderGroups"] = [t_cg[sg["nodes"][sa_s["colliderGroups"][c]["node"]]["name"]] for c in bg.get("colliderGroups", []) if sg["nodes"][sa_s["colliderGroups"][c]["node"]]["name"] in t_cg]
        nb["hitRadius"] = bg.get("hitRadius", 0.02) * k_mean
        nb["center"] = -1
        sa_t["boneGroups"].append(nb)
        moved += 1
    notes.append(f"hair from {src_name}: {len(prims)} parts, {len(hair_src)} bones, {moved} springs, scale {', '.join(f'{x:.2f}' for x in S)}")
    return binary


# How an older body differs from a sample's young one (recipe "rest": "elder-f" | "elder-m"), in metres of the file
# (a VRoid sample stands about 1.5 m; +x is the model's right side seen from the front: its LEFT bones are at -x, and
# it faces -z). Shorter legs (the thigh and the shin each a few centimetres: the hips come down, the feet stay on the
# ground), narrower lower shoulders, wider hips, a flatter bust.
REST_PRESETS = {
    "elder-f": {
        "J_Bip_C_Hips": (0, -0.08, 0),
        "J_Bip_L_LowerLeg": (0, 0.04, 0), "J_Bip_R_LowerLeg": (0, 0.04, 0),
        "J_Bip_L_Foot": (0, 0.04, 0), "J_Bip_R_Foot": (0, 0.04, 0),
        "J_Bip_L_UpperLeg": (-0.008, 0, 0), "J_Bip_R_UpperLeg": (0.008, 0, 0),
        "J_Bip_L_Shoulder": (0.008, -0.012, 0), "J_Bip_R_Shoulder": (-0.008, -0.012, 0),
        "J_Sec_L_Bust1": (0, 0, 0.02), "J_Sec_R_Bust1": (0, 0, 0.02),
        "J_Sec_L_Bust2": (0, 0, 0.012), "J_Sec_R_Bust2": (0, 0, 0.012),
    },
    "elder-m": {
        "J_Bip_C_Hips": (0, -0.06, 0),
        "J_Bip_L_LowerLeg": (0, 0.03, 0), "J_Bip_R_LowerLeg": (0, 0.03, 0),
        "J_Bip_L_Foot": (0, 0.03, 0), "J_Bip_R_Foot": (0, 0.03, 0),
        "J_Bip_L_Shoulder": (0.005, -0.012, 0), "J_Bip_R_Shoulder": (-0.005, -0.012, 0),
    },
}


def edit_rest(gltf, binary, moves, notes):
    """
    A body of other proportions, baked into its rest pose: bones moved (`moves`: bone name -> its own offset, carried
    by everything under it) and every skinned vertex moved with them by its weights, the inverse bind matrices made
    again. VRoid exports bones with no rotation or scale, so this is all translation. The file stays an ordinary
    model: the engine measures where its feet are as before. Returns the new BIN.
    """
    names = {n.get("name"): i for i, n in enumerate(gltf["nodes"])}
    own = {}
    for name, d in moves.items():
        if name in names:
            own[names[name]] = d
    if not own:
        notes.append("rest: no bone found")
        return binary
    at, par = _node_world(gltf)
    memo = {}

    def delta(i):
        if i in memo:
            return memo[i]
        p = par.get(i)
        base = delta(p) if p is not None else (0.0, 0.0, 0.0)
        o = own.get(i, (0.0, 0.0, 0.0))
        memo[i] = (base[0] + o[0], base[1] + o[1], base[2] + o[2])
        return memo[i]

    # the vertices, by their weights (each POSITION once, with the skin of the first node drawing it)
    skin_of_mesh = {n["mesh"]: n["skin"] for n in gltf["nodes"] if "mesh" in n and "skin" in n}
    done = {}
    for mi, mesh in enumerate(gltf["meshes"]):
        if mi not in skin_of_mesh:
            continue
        joints = gltf["skins"][skin_of_mesh[mi]]["joints"]
        jd = [delta(j) for j in joints]
        for prim in mesh["primitives"]:
            pa = prim["attributes"]["POSITION"]
            if pa in done:
                prim["attributes"]["POSITION"] = done[pa]
                continue
            pos, _ = _acc_array(gltf, binary, pa)
            js, _ = _acc_array(gltf, binary, prim["attributes"]["JOINTS_0"])
            ws, _ = _acc_array(gltf, binary, prim["attributes"]["WEIGHTS_0"])
            wa = gltf["accessors"][prim["attributes"]["WEIGHTS_0"]]
            scale = 1.0
            if wa.get("normalized") and wa["componentType"] == 5121:
                scale = 1 / 255
            elif wa.get("normalized") and wa["componentType"] == 5123:
                scale = 1 / 65535
            for v in range(len(pos) // 3):
                dx = dy = dz = 0.0
                for k in range(4):
                    w = ws[4 * v + k] * scale
                    if w <= 0:
                        continue
                    d = jd[js[4 * v + k]]
                    dx += w * d[0]
                    dy += w * d[1]
                    dz += w * d[2]
                pos[3 * v] += dx
                pos[3 * v + 1] += dy
                pos[3 * v + 2] += dz
            binary, view = _append(gltf, binary, _pack(pos, 5126, "VEC3"))
            a = dict(gltf["accessors"][pa])
            a.pop("byteOffset", None)
            a["bufferView"] = view
            a["min"] = [min(pos[c::3]) for c in range(3)]
            a["max"] = [max(pos[c::3]) for c in range(3)]
            gltf["accessors"].append(a)
            done[pa] = len(gltf["accessors"]) - 1
            prim["attributes"]["POSITION"] = done[pa]
    # the bones' own places and the inverse bind matrices
    new_world = {}
    for i in range(len(gltf["nodes"])):
        w = at(i)
        d = delta(i)
        new_world[i] = (w[0] + d[0], w[1] + d[1], w[2] + d[2])
    for i, o in own.items():
        t = gltf["nodes"][i].setdefault("translation", [0, 0, 0])
        gltf["nodes"][i]["translation"] = [t[0] + o[0], t[1] + o[1], t[2] + o[2]]
    for skin in gltf["skins"]:
        ib = []
        for j in skin["joints"]:
            w = new_world[j]
            ib.extend([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -w[0], -w[1], -w[2], 1])
        binary, view = _append(gltf, binary, _pack(ib, 5126, "MAT4"))
        gltf["accessors"].append({"bufferView": view, "componentType": 5126, "count": len(skin["joints"]), "type": "MAT4"})
        skin["inverseBindMatrices"] = len(gltf["accessors"]) - 1
    notes.append(f"rest: {len(own)} bones moved, {len(done)} vertex sets")
    return binary


def move_tail(gltf, binary, how, notes):
    """
    A ponytail higher and longer (recipe "tail": {"up": m, "center": share, "back": m, "stretch": factor}): the hair
    chain that hangs lowest is the tail; its root is moved up, towards the middle of the back of the head and back, and
    every bone after it is set further from the last (edit_rest moves the hair with them). Kim's portrait has a high
    long ponytail; the one ponytail the samples have hangs at the side.
    """
    at, par = _node_world(gltf)
    kids = {}
    for i, p in par.items():
        kids.setdefault(p, []).append(i)
    head = next(i for i, n in enumerate(gltf["nodes"]) if n.get("name") == "J_Bip_C_Head")
    hw = at(head)
    roots = [i for i in kids.get(head, []) if gltf["nodes"][i].get("name", "").startswith("HairJoint-")]

    def lowest(i):
        return min([at(i)[1]] + [lowest(c) for c in kids.get(i, [])])

    if not roots:
        notes.append("tail: no hair bones under the head")
        return binary
    root = min(roots, key=lowest)
    rw = at(root)
    moves = {gltf["nodes"][root]["name"]: (-(rw[0] - hw[0]) * how.get("center", 0), how.get("up", 0), how.get("back", 0))}
    k = how.get("stretch", 1.0) - 1.0

    def walk(i):
        for c in kids.get(i, []):
            t = gltf["nodes"][c].get("translation", [0, 0, 0])
            moves[gltf["nodes"][c]["name"]] = (t[0] * k, t[1] * k, t[2] * k)
            walk(c)

    walk(root)
    notes.append(f"tail: root {gltf['nodes'][root]['name'][:18]} and {len(moves) - 1} bones after it")
    return edit_rest(gltf, binary, moves, notes)


def apply_eyes(gltf, binary, settle, notes):
    """
    An older face's eyes (recipe "eyes": {"Close": 0.2, ...}): some of the face's own morph targets baked into its
    rest shape (lids a little lower, a softer look), so the big round anime eyes read older at the town's camera; blinks
    and expressions still play on top. Returns the new BIN.
    """
    for mesh in gltf["meshes"]:
        names = (mesh.get("extras") or {}).get("targetNames") or (mesh["primitives"][0].get("extras") or {}).get("targetNames")
        if not names:
            continue
        picks = []
        for key, w in settle.items():
            hit = next((i for i, n in enumerate(names) if n.endswith("Fcl_EYE_" + key)), None)
            if hit is None:
                notes.append(f"eyes: no morph Fcl_EYE_{key}")
                continue
            picks.append((hit, w))
        if not picks:
            continue
        moved = {}
        for prim in mesh["primitives"]:
            pa = prim["attributes"]["POSITION"]
            if pa in moved or not prim.get("targets"):
                continue
            pos, _ = _acc_array(gltf, binary, pa)
            for ti, w in picks:
                delta, _ = _acc_array(gltf, binary, prim["targets"][ti]["POSITION"])
                for i in range(len(pos)):
                    pos[i] += delta[i] * w
            data = struct.pack("<" + "f" * len(pos), *pos)
            binary, view = _append(gltf, binary, data)
            a = dict(gltf["accessors"][pa])
            a.pop("byteOffset", None)
            a["bufferView"] = view
            a["min"] = [min(pos[c::3]) for c in range(3)]
            a["max"] = [max(pos[c::3]) for c in range(3)]
            gltf["accessors"].append(a)
            moved[pa] = len(gltf["accessors"]) - 1
        for prim in mesh["primitives"]:
            if prim["attributes"]["POSITION"] in moved:
                prim["attributes"]["POSITION"] = moved[prim["attributes"]["POSITION"]]
        notes.append("eyes: " + ", ".join(f"{k} {w}" for k, w in settle.items()))
    return binary


def paint_blouse(img, colour):
    """
    The dark top a sample paints on the body's chest (AvatarSample_A's black lace camisole, under the cardigan) in a
    light colour instead, its folds kept: Grace's portrait has a white blouse under the pink cardigan. Only the dark
    pixels of the chest's panel of the template (u 0.236 .. 0.762, v 0 .. 0.47) change; the skin round it stays.
    """
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    x0, x1, y1 = int(w * LEG_U[0]), int(w * LEG_U[1]), int(h * 0.47)
    for y in range(0, y1):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum >= 95:
                continue
            # dark cloth -> the colour, its own light and shade kept; the lace's edge blends
            k = min(1.0, (95 - lum) / 35)
            shade = 0.86 + lum / 255 * 0.5
            nr, ng, nb = (min(255, int(c * shade)) for c in colour)
            px[x, y] = (int(r + (nr - r) * k), int(g + (ng - g) * k), int(b + (nb - b) * k), a)
    return rgba


# ---------------------------------------------------------------- bake

def bake(rid, recipe):
    src = os.path.join(SRC_DIR, recipe["base"] + ".vrm")
    gltf, binary, in_size, _ = read_glb(src)
    if len(gltf.get("buffers", [])) != 1:
        raise ValueError(f"{src}: expected one buffer")
    notes = []
    if recipe.get("hair_from"):
        binary = apply_hair(gltf, binary, recipe["hair_from"], notes, keep_front=bool(recipe.get("keep_fringe")))
    if recipe.get("tail"):
        binary = move_tail(gltf, binary, recipe["tail"], notes)
    if recipe.get("slacks"):
        binary = apply_slacks(gltf, binary, recipe, notes)
    if recipe.get("rest"):
        binary = edit_rest(gltf, binary, REST_PRESETS[recipe["rest"]], notes)
    if recipe.get("eyes_settle"):
        binary = apply_eyes(gltf, binary, recipe["eyes_settle"], notes)

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
    # every colour image of the body (MToon shades with an image of its own: both get a blouse)
    body_imgs = {textures[ti]["source"] for mi, n in enumerate(names) if n.endswith("Body_00_SKIN")
                 for slot, ti in uses[mi] if slot in ("baseColor",) + COLOUR_SLOTS and ti < len(textures)}
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
    # A light colour on a sample's dark hair needs a floor, or grey and blond come out black at the roots: the
    # lighter the target, the higher (black stays black).
    hair_lift = min(0.62, (0.299 * hair[0] + 0.587 * hair[1] + 0.114 * hair[2]) / 255.0 * 0.78)
    brow = tuple(int(round(c * 0.75)) for c in hair)
    # images only a material nobody draws with uses (this body's own hair, replaced by "hair_from"): left as one pixel
    used_mats = {p.get("material") for m in gltf["meshes"] for p in m["primitives"]}
    live, dead = set(), set()
    for mi, u in enumerate(material_texture_uses(gltf)):
        for _slot, ti in u:
            if ti < len(textures) and "source" in textures[ti]:
                (live if mi in used_mats else dead).add(textures[ti]["source"])
    unused_imgs = dead - live
    new_images = {}
    for ii, im in enumerate(gltf.get("images", [])):
        if "bufferView" not in im:
            continue
        if ii in unused_imgs:
            new_images[ii] = encode_webp(Image.new("RGBA", (1, 1), (255, 255, 255, 255)))
            im["mimeType"] = "image/webp"
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
                if ii in body_imgs and recipe.get("blouse"):
                    img = paint_blouse(img, hex_rgb(recipe["blouse"]))
            elif cls == "hair":
                img = recolour_luma(img, hair, lift=hair_lift)
            elif cls == "brow":
                img = recolour_luma(img, brow, lift=hair_lift * 0.5)
            elif cls == "eyes":
                img = recolour_luma(img, hex_rgb(recipe["eyes"]), keep=0.3, lift=0.2)
            elif cls == "clothes":
                want = recipe["clothes"][kw]
                if isinstance(want, list):
                    img = recolour_duo(img, hex_rgb(want[0]), hex_rgb(want[1]))
                else:
                    img = recolour_luma(img, hex_rgb(want), keep=0.12, lift="auto")
        new_images[ii] = encode_webp(img)
        im["mimeType"] = "image/webp"

    # Shade colours of the recoloured materials.
    props = gltf["extensions"]["VRM"].get("materialProperties", [])
    for p in props:
        cls = material_class(p.get("name", ""), recipe)
        if not cls or cls[0] in ("brow", "eyes"):
            continue
        vec = p.setdefault("vectorProperties", {})
        old = vec.get("_ShadeColor", [1, 1, 1, 1])
        alpha = old[3] if len(old) > 3 else 1
        vec["_ShadeColor"] = (SHADE_SKIN if cls[0] == "skin" else SHADE_OTHER) + [alpha]
        # The colour is in the texture now: a sample that tinted a pale texture through the material's colour
        # (black hair on a grey texture) would darken the new colour again.
        col = vec.get("_Color", [1, 1, 1, 1])
        vec["_Color"] = [1.0, 1.0, 1.0, col[3] if len(col) > 3 else 1]

    for mat in gltf.get("materials", []):
        cls = material_class(mat.get("name", ""), recipe)
        if not cls:
            continue
        pbr = mat.setdefault("pbrMetallicRoughness", {})
        f = pbr.get("baseColorFactor", [1, 1, 1, 1])
        pbr["baseColorFactor"] = [1.0, 1.0, 1.0, f[3] if len(f) > 3 else 1]

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
