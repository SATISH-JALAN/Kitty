import { SealDirectorProvider } from "@/components/chrome/SealDirector";
import { Header } from "@/components/chrome/Header";
import { DevnetTag } from "@/components/chrome/DevnetTag";
import { Cursor } from "@/components/chrome/Cursor";
import { copy } from "@/copy/en";
import { Act0Preloader } from "./_acts/Act0Preloader";
import { Act1Invitation } from "./_acts/Act1Invitation";
import { Act2Traditions } from "./_acts/Act2Traditions";
import { Act3Theatre } from "./_acts/Act3Theatre";
import { Act4Party } from "./_acts/Act4Party";
import { Act5Masks } from "./_acts/Act5Masks";
import { Act6Diary } from "./_acts/Act6Diary";
import { Act7HouseFund } from "./_acts/Act7HouseFund";
import { Finale } from "./_acts/Finale";
import { Footer } from "./_acts/Footer";
import "./landing.css";

export default function Landing() {
  return (
    <SealDirectorProvider>
      <a href="#rsvp" className="skip-link">
        {copy.nav.skip}
      </a>
      <Header initialWorld="night" />
      <main id="main" className="landing">
        <Act0Preloader />
        <Act1Invitation />
        <Act2Traditions />
        <Act3Theatre />
        <Act4Party />
        <Act5Masks />
        <Act6Diary />
        <Act7HouseFund />
        <Finale />
      </main>
      <Footer />
      <DevnetTag />
      <Cursor />
    </SealDirectorProvider>
  );
}
