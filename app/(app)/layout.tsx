import { TabBar } from "@/components/layout/TabBar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <TabBar />
    </>
  );
}
