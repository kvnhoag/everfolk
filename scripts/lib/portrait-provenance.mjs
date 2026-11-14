/** Compact provenance for delivered portraits; complete masters remain in private storage. */
import { createHash } from "node:crypto";

export function portraitProvenance(sourceBytes, source, audit, visual) {
  return {
    schemaVersion: 1,
    libraryId: source.libraryId,
    sourceManifestSha256: createHash("sha256").update(sourceBytes).digest("hex"),
    userReviewStatus: source.userReviewStatus,
    anatomicalApproval: source.anatomicalApproval,
    pixelProfile: source.pixelProfile,
    limitations: source.limitations,
    sourceAudit: audit,
    visualReview: visual,
    portraits: source.portraits.map(({ id, identityId, sex, stage, wardrobeId, path, sha256 }) => ({ id, identityId, sex, stage, wardrobeId, path, sha256 })),
  };
}
