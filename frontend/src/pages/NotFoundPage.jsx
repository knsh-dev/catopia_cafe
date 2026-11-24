import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cat } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-12 text-center bg-cream">
      <Cat className="h-16 w-16 text-caramel mb-4" />
      <h1 className="font-heading text-4xl font-bold text-espresso mb-2">404</h1>
      <p className="text-muted-foreground mb-6">
        Oops! This page has wandered off like a curious cat.
      </p>
      <Button asChild>
        <Link to="/">Back to Home</Link>
      </Button>
    </div>
  );
}
