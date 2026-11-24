import { tr } from '../../i18n';

/** An item's tip: quoted respellings ("ai-kən KUM") are shown as .respell, without the quotes. */
export default function CueText({ text }: { text: string }) {
  // translated before the split: the dictionary's key is the whole tip
  const parts = tr(text).split(/"([^"]+)"/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="respell" lang="en">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}
