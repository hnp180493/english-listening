// English for the 'ui/cloud' area (docs/i18n.md). Keys are the Vietnamese strings exactly as written in the code;
// a key with {} is a tl template: its English uses {0}, {1}… and {0|one|many} for a plural.
const cloud: Record<string, string> = {
  'Đã hủy đăng nhập Google.': 'Google sign-in was cancelled.',
  'Đăng nhập Google không thành công. Hãy thử lại.': 'Google sign-in didn’t work. Please try again.',
  'Không kết nối được máy chủ (đang ngoại tuyến?).': 'Couldn’t reach the server (are you offline?).',
  'Máy chủ trả về phiên đăng nhập không hợp lệ.': 'The server returned an invalid sign-in session.',
  'Máy chủ đăng nhập đang bận. Hãy thử lại sau.': 'The sign-in server is busy. Please try again later.',
  'Mã đăng nhập không dùng được (đã hết hạn hoặc đã dùng rồi). Hãy đăng nhập lại.': 'This sign-in code can’t be used (it has expired or was already used). Please sign in again.',
  'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.': 'Your sign-in has expired. Please sign in again.',
  'Bạn đã đăng xuất.': 'You’ve signed out.',
  'Trình duyệt đang chặn bộ nhớ của trang.': 'The browser is blocking this page’s storage.',
  'Không tìm thấy lượt đăng nhập đang chờ trên trình duyệt này. Hãy bấm đăng nhập lại.': 'No pending sign-in was found in this browser. Please sign in again.',
  'Đã đăng nhập {} và gộp dữ liệu từ tài khoản. Đang tải lại…': 'Signed in as {0} and merged the data from your account. Reloading…',
  'Đã đăng nhập {}.': 'Signed in as {0}.',
  'Bản này chưa được cấu hình đăng nhập.': 'Sign-in isn’t set up in this version.',
  'Trình duyệt này không hỗ trợ đăng nhập an toàn (thiếu Web Crypto).': 'This browser doesn’t support secure sign-in (Web Crypto is missing).',
  'Trình duyệt chặn cửa sổ mới. Hãy cho phép cửa sổ bật lên rồi bấm lại.': 'The browser blocked the new window. Allow pop-ups, then try again.',
  'Mã không đúng. Hãy chép lại nguyên mã.': 'That code isn’t right. Copy the whole code again.',
  'Lượt đăng nhập này đã quá hạn. Hãy bấm “Đăng nhập bằng Google” lại.': 'This sign-in has expired. Choose “Sign in with Google” again.',
  'Đồng bộ tài khoản gặp lỗi không mong muốn. Sẽ thử lại sau.': 'Account sync hit an unexpected error. It will try again later.',
  'Bộ nhớ trình duyệt đã đầy, không gộp được dữ liệu từ tài khoản.': 'The browser’s storage is full, so the account data couldn’t be merged.',
  'Dữ liệu trên tài khoản đã quá giới hạn cho phép (25 MB), chưa ghi được.': 'The data in your account is over the allowed limit (25 MB), so it couldn’t be saved.',
  'Một máy khác đang ghi dữ liệu cùng lúc. Sẽ thử lại sau.': 'Another device is saving data at the same time. It will try again later.',
  'Kho dữ liệu trên máy chủ chưa được tạo (chưa chạy migration của Nghe Nối Âm).': 'The data store on the server hasn’t been created (Nghe Nối Âm’s migration hasn’t been run).',
  'Máy chủ báo lỗi ({}). Sẽ thử lại sau.': 'Server error ({0}). It will try again later.',
  'Máy chủ trả về kết quả lạ khi ghi dữ liệu.': 'The server returned an unexpected result when saving data.',
  'Máy chủ báo lỗi ({}).': 'Server error ({0}).',
};

export default cloud;
