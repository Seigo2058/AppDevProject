import GreetingHeader from "./components/home/GreetingHeader";
import TodayScheduleSection from "./components/home/TodayScheduleSection";
import MyRouteSection from "./components/home/MyRouteSection";

export default function Home() {
  return (
    <div className="min-h-full bg-[#eee] px-4 pt-4 pb-8 flex flex-col gap-6">
      <GreetingHeader />
      <TodayScheduleSection />
      <MyRouteSection />
    </div>
  );
}
