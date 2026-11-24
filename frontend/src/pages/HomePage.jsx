import HeroSection from "@/components/landing/HeroSection";
import CozyComfortSection from "@/components/landing/CozyComfortSection";
import PopularPicksSection from "@/components/landing/PopularPicksSection";
import CatRoomSection from "@/components/landing/CatRoomSection";
import ResidentCatsSection from "@/components/landing/ResidentCatsSection";
import MapSection from "@/components/landing/MapSection";
import SubscribeSection from "@/components/landing/SubscribeSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <CozyComfortSection />
      <PopularPicksSection />
      <CatRoomSection />
      <ResidentCatsSection />
      <MapSection />
      <SubscribeSection />
    </>
  );
}
