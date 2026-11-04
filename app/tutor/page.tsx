import { Button } from "@/components/ui/Button";
import { Placeholder } from "@/components/shell/Placeholder";

export default function TutorPage() {
  return (
    <Placeholder
      kicker="Tutor"
      title="Ask your own"
      highlight="notes"
      body="Chat grounded in your notebook comes later. Live Tutor is a dark full-screen room, still a placeholder."
    >
      <Button href="/tutor/live">Open Live Tutor</Button>
    </Placeholder>
  );
}
