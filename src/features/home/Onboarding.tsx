import { tl } from '../../i18n';

/** The app's name: the same in both languages (a value of the sentence, so the English entry holds no Vietnamese). */
const APP_NAME = 'Nghe Nối Âm';

export interface OnboardingProps {
  /** Finish and open lesson 1 (or the lesson list when there are no lessons yet). */
  onStart: () => void;
  onSkip: () => void;
  hasLessons: boolean;
}

/** First visit: one sentence, one primary action, one way out. Reopened from Cài đặt → Giới thiệu. */
export default function Onboarding({ onStart, onSkip, hasLessons }: OnboardingProps) {
  return (
    <section className="card home-onb" aria-labelledby="home-onb-title">
      <div className="home-onb-text">
        <h2 id="home-onb-title">{tl`Chào mừng bạn đến với ${APP_NAME}`}</h2>
        <p>
          Người bản xứ nối, nuốt và rút gọn âm. Bài 1 chỉ mất vài phút để bạn bắt đầu nghe ra điều đó.
        </p>
      </div>
      <div className="home-onb-btns">
        <button type="button" className="btn btn-primary" onClick={onStart}>
          {hasLessons ? 'Bắt đầu' : 'Xem bài học'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onSkip}>
          Bỏ qua
        </button>
      </div>
    </section>
  );
}
