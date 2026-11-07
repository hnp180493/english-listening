// Library of saved videos / audio files, plus the add form and the opt-in YouTube help.

import { useCallback, useRef, useState } from 'react';
import { Film, Headphones, MoreHorizontal, PencilLine, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import Popover from '../../components/Popover';
import { youTubeThumb } from '../../core/media/youtube';
import { scrollBehavior } from '../../core/motion';
import { hrefFor } from '../../core/nav';
import AddForm, { YouTubeHowTo } from './AddForm';
import {
  MAX_TITLE_LENGTH,
  donePercent,
  relativeDay,
  resetProgress,
  sortItems,
  type MediaItem,
  type MediaLibrary,
} from './library';
import { deleteItem, dismissSaveWarning, updateItem, useSaveFailed } from './store';

const STEPS = ['Chọn video có phụ đề', 'Dán bản chép lời', 'Nghe và chép từng câu'];

function kindLabel(item: MediaItem): string {
  return item.kind === 'youtube' ? 'YouTube' : item.fileType === 'audio' ? 'Audio' : 'Video';
}

function ItemCard({ item, now }: { item: MediaItem; now: number }) {
  const [menu, setMenu] = useState<'none' | 'confirm-delete' | 'rename' | 'confirm-reset'>('none');
  const [name, setName] = useState(item.title);
  const [thumbFailed, setThumbFailed] = useState(false);
  const pct = donePercent(item);
  const href = hrefFor('media', { id: item.id });
  const started = item.progress.done.length > 0 || Object.keys(item.progress.scores).length > 0 || item.progress.unitIndex > 0;

  const saveName = () => {
    const t = name.trim().slice(0, MAX_TITLE_LENGTH);
    if (t) updateItem(item.id, (it) => ({ ...it, title: t }));
    setMenu('none');
  };

  return (
    <li>
      <div className="item-card media-card">
        <div className="media-card-thumb" aria-hidden="true">
          {item.kind === 'youtube' && item.youtubeId && !thumbFailed ? (
            <img
              src={youTubeThumb(item.youtubeId)}
              alt=""
              loading="lazy"
              width={320}
              height={180}
              onError={() => setThumbFailed(true)}
            />
          ) : (
            <Icon icon={item.fileType === 'audio' ? Headphones : Film} size={28} />
          )}
        </div>

        <div className="media-card-head">
          {menu === 'rename' ? (
            <form
              className="row media-rename"
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
              }}
            >
              <input
                className="input"
                value={name}
                maxLength={MAX_TITLE_LENGTH}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setMenu('none');
                }}
                aria-label="Tên mới"
                autoFocus
              />
              <button type="submit" className="btn btn-sm btn-soft">
                Lưu
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMenu('none')}>
                Huỷ
              </button>
            </form>
          ) : (
            <>
              <h2 className="item-card-title media-card-title">
                <a className="media-card-link" href={href} title={item.title}>
                  {item.title}
                </a>
              </h2>
              <Popover
                className="media-card-menu"
                triggerClassName="btn btn-ghost btn-sm btn-icon"
                trigger={<Icon icon={MoreHorizontal} size={18} />}
                triggerLabel={`Tùy chọn cho ${item.title}`}
                title="Tùy chọn"
                align="end"
              >
                {(close) => (
                  <div className="media-menu">
                    <button
                      type="button"
                      className="btn btn-ghost media-menu-item"
                      onClick={() => {
                        setName(item.title);
                        setMenu('rename');
                        close();
                      }}
                    >
                      <Icon icon={PencilLine} size={16} />
                      Đổi tên
                    </button>
                    {started && (
                      <button
                        type="button"
                        className="btn btn-ghost media-menu-item"
                        onClick={() => {
                          setMenu('confirm-reset');
                          close();
                        }}
                      >
                        <Icon icon={RotateCcw} size={16} />
                        Luyện lại từ đầu
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost media-menu-item media-btn-del"
                      onClick={() => {
                        setMenu('confirm-delete');
                        close();
                      }}
                    >
                      <Icon icon={Trash2} size={16} />
                      Xoá
                    </button>
                  </div>
                )}
              </Popover>
            </>
          )}
        </div>

        <span className="item-card-meta">
          {kindLabel(item)} · {item.units.length} câu
          {item.openedAt ? ` · mở ${relativeDay(item.openedAt, now).toLowerCase()}` : ''}
        </span>

        {menu === 'confirm-delete' ? (
          <div className="media-confirm is-danger" role="alert">
            <span>Xoá “{item.title}” và toàn bộ tiến độ?</span>
            <div className="row">
              <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteItem(item.id)}>
                <Icon icon={Trash2} size={14} />
                Xoá
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMenu('none')} autoFocus>
                Huỷ
              </button>
            </div>
          </div>
        ) : menu === 'confirm-reset' ? (
          <div className="media-confirm" role="alert">
            <span>Xoá điểm và dấu đã xong để luyện lại từ đầu?</span>
            <div className="row">
              <button
                type="button"
                className="btn btn-sm btn-soft"
                onClick={() => {
                  updateItem(item.id, resetProgress);
                  setMenu('none');
                }}
              >
                Làm lại
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMenu('none')} autoFocus>
                Huỷ
              </button>
            </div>
          </div>
        ) : (
          started && (
            <span className="item-card-foot">
              <span
                className={'progress' + (pct >= 100 ? ' is-done' : '')}
                role="progressbar"
                aria-label={`Tiến độ ${item.title}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <span style={{ width: `${pct}%` }} />
              </span>
              {pct}%
            </span>
          )
        )}
      </div>
    </li>
  );
}

export default function LibraryView({ library }: { library: MediaLibrary }) {
  const items = sortItems(library.items);
  const empty = items.length === 0;
  const [adding, setAdding] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const howRef = useRef<HTMLDetailsElement>(null);
  const [now] = useState(() => Date.now());
  const saveFailed = useSaveFailed();
  const showForm = empty || adding;

  // stable: AddForm opens the help from an effect when a pasted transcript has no times
  const openHow = useCallback((show: boolean) => {
    setHowOpen(true);
    if (show) requestAnimationFrame(() => howRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }));
  }, [setHowOpen]);

  return (
    // an empty library is one task (add the first video): the narrow column; a library to browse: the full one
    <div className={'media media-lib stack-lg ' + (empty ? 'page-focus' : 'page-browse')}>
      <PageHeader
        title="Video thật"
        subtitle="Luyện nghe video YouTube hoặc audio của bạn, từng câu một."
        actions={
          !showForm && (
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <Icon icon={Plus} size={17} />
              Thêm video/audio
            </button>
          )
        }
      />

      {saveFailed && (
        <div className="callout callout-warn media-save-warn" role="status">
          <Icon icon={TriangleAlert} size={16} />
          <span>Chưa lưu được thay đổi vào trình duyệt (bộ nhớ có thể đã đầy). Hãy xoá bớt video cũ để giải phóng chỗ.</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={dismissSaveWarning}>
            Đã hiểu
          </button>
        </div>
      )}

      {showForm && <AddForm onCancel={empty ? undefined : () => setAdding(false)} onNeedHelp={openHow} />}

      <section className="stack media-lib-list" aria-labelledby="media-lib-h">
        <h2 id="media-lib-h" className="section-title">
          Thư viện {!empty && <span className="meta">· {items.length} mục</span>}
        </h2>
        {empty ? (
          <div className="card media-empty">
            <p>Thư viện còn trống. Thêm video đầu tiên ở trên:</p>
            <ol className="media-empty-steps">
              {STEPS.map((st, i) => (
                <li key={st}>
                  <span className="media-empty-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  {st}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <ul className="card-grid media-grid" aria-label="Thư viện của bạn">
            {items.map((it) => (
              <ItemCard key={it.id} item={it} now={now} />
            ))}
          </ul>
        )}
      </section>

      {showForm && <YouTubeHowTo ref={howRef} open={howOpen} onOpenChange={setHowOpen} />}
    </div>
  );
}
