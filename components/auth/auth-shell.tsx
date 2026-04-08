"use client";

import { motion } from "framer-motion";

import { Card } from "@/components/ui/card";

type Props = {
  title: string;
  children: React.ReactNode;
};

export function AuthShell({ title, children }: Props) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-violet-50 px-4 py-16 dark:bg-violet-950">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <Card>
          <h1 className="mb-6 text-center text-2xl font-semibold text-violet-900 dark:text-violet-50">
            {title}
          </h1>
          {children}
        </Card>
      </motion.div>
    </div>
  );
}
