type LogoutConfirmHandler = () => Promise<boolean>;

let logoutConfirmHandler: LogoutConfirmHandler | null = null;

export function registerLogoutConfirmHandler(handler: LogoutConfirmHandler) {
  logoutConfirmHandler = handler;

  return () => {
    if (logoutConfirmHandler === handler) {
      logoutConfirmHandler = null;
    }
  };
}

export async function confirmLogout() {
  if (logoutConfirmHandler) {
    return logoutConfirmHandler();
  }

  return window.confirm("Are you sure you want to log out?");
}
