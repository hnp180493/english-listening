// "Video thật": practise with real native speech (YouTube or the learner's own files).
// Route: #/media → library; #/media?id=<itemId>[&unit=<n>] → player (at transcript line n when given).

import { ArrowLeft, SearchX } from 'lucide-react';
import { Icon, IconTile } from '../../components/Icon';
import { hrefFor, useRoute } from '../../core/nav';
import LibraryView from './LibraryView';
import PlayerView from './PlayerView';
import { parseUnitParam } from './reviewPlan';
import { useMediaLibrary } from './store';
import './media.css';

export default function MediaPage() {
  const { params } = useRoute();
  const library = useMediaLibrary();
  const id = params.id;
  const unit = parseUnitParam(params.unit);

  if (id) {
    const item = library.items.find((i) => i.id === id);
    if (!item) {
      return (
        <div className="media stack-lg page-focus">
          <section className="card empty-state media-missing">
            <IconTile icon={SearchX} tint="var(--text-muted)" size="lg" />
            <h1>Không tìm thấy mục này</h1>
            <p>Có thể bạn đã xoá nó, hoặc dữ liệu trình duyệt đã bị dọn.</p>
            <div className="row">
              <a className="btn btn-primary" href={hrefFor('media')}>
                <Icon icon={ArrowLeft} size={16} />
                Về thư viện
              </a>
            </div>
          </section>
        </div>
      );
    }
    return (
      <div className="media">
        <PlayerView key={`${item.id}:${unit ?? ''}`} item={item} prefs={library.prefs} startUnit={unit} />
      </div>
    );
  }

  return <LibraryView library={library} />;
}
