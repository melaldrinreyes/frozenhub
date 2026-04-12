import { useEffect, useRef, useState } from "react";
import { AlertTriangle, LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { registerLogoutConfirmHandler } from "@/lib/logout";

export default function LogoutConfirmHost() {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  useEffect(() => {
    const unregister = registerLogoutConfirmHandler(() => {
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setOpen(true);
      });
    });

    return () => {
      if (resolverRef.current) {
        resolverRef.current(false);
        resolverRef.current = null;
      }
      unregister();
    };
  }, []);

  const resolveAndClose = (confirmed: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    if (resolve) {
      resolve(confirmed);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) {
          resolveAndClose(false);
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <AlertDialogContent className="max-w-md border-gold-500/30 bg-gradient-to-b from-black via-gray-900 to-black text-white shadow-2xl">
        <AlertDialogHeader className="space-y-3 text-left">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-gold-500/30 bg-gold-500/20 p-2">
              <AlertTriangle className="h-5 w-5 text-gold-400" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-gold-400">
              Confirm Logout
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm text-gray-300">
            You are about to sign out of your account. Continue?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel
            onClick={() => resolveAndClose(false)}
            className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
          >
            Stay Logged In
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => resolveAndClose(true)}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
