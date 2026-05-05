import { Card } from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
};

/** Placeholder for sections without backend data in the current MVP. */
export function PlaceholderSection({ title, description }: Props) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}
