import type { Metadata } from "next";
import CardArtCatalogue from "../../client/components/CardArtCatalogue.tsx";
import SiteNav from "../../client/components/SiteNav.tsx";
import "../../client/styles/card-art-catalogue.css";

export const metadata: Metadata = { title: "Card collection · Everfolk", description: "Explore 117 Everfolk card designs: 13 historical figures and the professions, contributions and stories around them." };

export default function CardsPage() {
  return <div className="card-collection-page">
    <header className="card-collection-page-header"><a className="card-collection-wordmark" href="/">EVERFOLK</a>
      <SiteNav className="card-collection-page-nav" rootHref="/" activeSection="figures" />
    </header>
    <main><CardArtCatalogue /></main>
    <footer className="card-collection-page-footer"><a href="/#figures">Onchain figure ownership &amp; deeds</a><a href="/">Return to Everfolk</a></footer>
  </div>;
}
