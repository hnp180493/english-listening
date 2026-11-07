import type { MouseEvent } from 'react';
import { Mic, ScanText } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { isCustomId } from '../../core/dictation/custom';
import { hrefFor, navigate, type RouteId } from '../../core/nav';
import type { Sentence } from '../../core/types';

function go(e: MouseEvent<HTMLAnchorElement>, id: RouteId, params: Record<string, string>) {
  // plain click → in-app navigation; ctrl/cmd/middle click keeps the browser's default (new tab)
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(id, params);
}

/** Shown after a wrong answer: practise the same sentence in another module (two quiet links). */
export default function FollowUps({ sentence }: { sentence: Sentence }) {
  const shadowParams: Record<string, string> = isCustomId(sentence.id) ? { text: sentence.text } : { id: sentence.id };
  const decoderParams = { text: sentence.text };
  return (
    <nav className="dict-follow" aria-label="Luyện thêm câu này">
      <a className="btn btn-ghost btn-sm" href={hrefFor('shadowing', shadowParams)} onClick={(e) => go(e, 'shadowing', shadowParams)}>
        <Icon icon={Mic} size={15} />
        Nói nhại câu này
      </a>
      <a className="btn btn-ghost btn-sm" href={hrefFor('decoder', decoderParams)} onClick={(e) => go(e, 'decoder', decoderParams)}>
        <Icon icon={ScanText} size={15} />
        Giải mã câu này
      </a>
    </nav>
  );
}
