import { Suspense } from "react";

import WorkspaceSetPasswordView from "../components/WorkspaceSetPasswordView";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceSetPasswordView />
    </Suspense>
  );
}
