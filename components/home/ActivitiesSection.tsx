import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import type { ActivityProgress } from "@/lib/notebook";

export function ActivitiesSection({
  activities,
  reduce,
}: {
  activities: ActivityProgress[];
  reduce: boolean;
}) {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-6">
      <Reveal reduce={reduce} delay={0.5}>
        <SectionHeading before="Your" highlight="Activities" />
      </Reveal>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {activities.map((activity, index) => {
          const done = activity.progress >= activity.goal;
          const width = Math.min(100, Math.round((activity.progress / activity.goal) * 100));
          return (
            <Reveal key={activity.id} reduce={reduce} delay={0.56 + index * 0.06}>
              <Card className="flex h-full min-w-0 flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="min-w-0 text-lg font-semibold text-ink">{activity.label}</h3>
                  {done ? (
                    <span className="nw-mono shrink-0 border-2 border-ink bg-yellow px-2 py-1 text-[12px] text-ink">Done</span>
                  ) : null}
                </div>
                <div
                  className="border-2 border-ink bg-page"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={activity.goal}
                  aria-valuenow={Math.min(activity.progress, activity.goal)}
                  aria-label={activity.label}
                >
                  <div className="h-3 bg-green-600" style={{ width: `${width}%` }} />
                </div>
                <p className="nw-mono text-[12px] text-muted">
                  {activity.progress} / {activity.goal}
                </p>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
