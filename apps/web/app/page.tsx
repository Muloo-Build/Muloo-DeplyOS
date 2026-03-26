import AuthGate from "./components/AuthGate";
import MulooCommandCentre from "./components/MulooCommandCentre";

export default function Home() {
  return (
    <AuthGate>
      <MulooCommandCentre />
    </AuthGate>
  );
}
