"use client";

import { motion } from "framer-motion";

import { Card } from "@/components/ui/card";

type Props = {
  title: string;
  children: React.ReactNode;
};

export function AuthShell({ title, children }: Props) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <Card className="border-border bg-card text-card-foreground shadow-md">
          <h1 className="font-display mb-6 text-center text-2xl font-bold text-foreground">{title}</h1>
          {children}
        </Card>
      </motion.div>
    </div>
  );
}
