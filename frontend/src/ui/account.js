import { button, dialogHeader } from './views.js';

export function accountControl(account) {
  return button('account', account?.username ?? '登录 / 注册', 'people', {
    class: 'secondary account-button', attrs: 'aria-haspopup="dialog"',
  });
}

export function accountDialog(account, mode) {
  if (account) {
    return `${dialogHeader('WINDOWSILL ACCOUNT', '我的账号', `已登录为 ${account.username}，种植进度会保存在此账号。`)}
      <div class="account-fields"><p id="account-feedback" class="account-feedback" role="alert" hidden></p></div>
      <div class="simple-footer">${button('close', '返回窗台', '', { class: 'quiet' })}${button('logout', '退出登录')}</div>`;
  }
  const registering = mode === 'register';
  const label = registering ? '注册并保留进度' : '登录';
  return `${dialogHeader('WINDOWSILL ACCOUNT', registering ? '注册账号' : '登录花园', registering ? '把当前窗台绑定到新账号。' : '打开你的账号窗台，继续照料之前种下的花。')}
    <div class="account-modes" role="group" aria-label="账号操作">
      ${button('auth-mode', '登录', '', { attrs: `data-mode="login" aria-pressed="${!registering}"` })}
      ${button('auth-mode', '注册', '', { attrs: `data-mode="register" aria-pressed="${registering}"` })}
    </div>
    <form id="account-form" method="post" data-mode="${mode}">
      <div class="account-fields">
        <label for="account-username">用户名</label>
        <input id="account-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="32" pattern="[A-Za-z0-9_]{3,32}" ${registering ? 'aria-describedby="username-hint"' : ''}>
        ${registering ? '<small id="username-hint">3–32 个英文字母、数字或下划线。</small>' : ''}
        <label for="account-password">密码</label>
        <input id="account-password" name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" required maxlength="256" ${registering ? 'minlength="15" aria-describedby="password-hint"' : ''}>
        ${registering ? '<small id="password-hint">15–128 个字符，可以使用容易记住的长密码短语。</small><label for="account-confirm">确认密码</label><input id="account-confirm" name="confirm" type="password" autocomplete="new-password" required maxlength="256">' : ''}
        <p id="account-feedback" class="account-feedback" role="alert" hidden></p>
      </div>
      <div class="simple-footer"><button type="submit" class="button primary">${label}</button></div>
    </form>`;
}
