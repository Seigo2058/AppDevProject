import GreetingHeader from "./components/home/GreetingHeader";
import TodayScheduleSection from "./components/home/TodayScheduleSection";
import MyRouteSection from "./components/home/MyRouteSection";
import OtherLinksSection from "./components/home/OtherLinksSection";

export default function Home() {
  return (
    <div className="px-4 pt-2 pb-8 space-y-8">
      <GreetingHeader />
      <TodayScheduleSection />
      <MyRouteSection />
      <OtherLinksSection />
    </div>
  );
}
