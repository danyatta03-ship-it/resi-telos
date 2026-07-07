import IntroAnimation from "@/components/IntroAnimation";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import WorksSlider from "@/components/WorksSlider";
import Product360Section from "@/components/Product360Section";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <IntroAnimation />
      <Header />
      <main className="flex-1">
        <Hero />
        <WorksSlider />
        <Product360Section />
      </main>
      <Footer />
    </>
  );
}
