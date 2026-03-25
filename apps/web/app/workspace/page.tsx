import AuthGate from "../components/AuthGate";
import MulooCommandCentre from "../components/MulooCommandCentre";

export default function WorkspacePage() {
  return (
    <AuthGate>
      <MulooCommandCentre />
    </AuthGate>
  );
}
