// GET /api/competitions
// Liste toutes les compétitions disponibles selon le fournisseur actif.

import { NextResponse } from "next/server";
import { getCompetitions, activeProviderName } from "@/lib/footballData";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const competitions = await getCompetitions();
    return NextResponse.json({
      provider: activeProviderName(),
      competitions,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Erreur serveur", competitions: [] },
      { status: 500 }
    );
  }
}
