ALTER TABLE "Content" ADD COLUMN "categoryId" TEXT;

CREATE TABLE "ContentCategory" (
  "id" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT 'violet',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContentCategory_creatorId_name_key" ON "ContentCategory"("creatorId", "name");
CREATE INDEX "ContentCategory_creatorId_name_idx" ON "ContentCategory"("creatorId", "name");

CREATE TABLE "ContentCollection" (
  "id" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentCollection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContentCollection_creatorId_name_key" ON "ContentCollection"("creatorId", "name");
CREATE INDEX "ContentCollection_creatorId_name_idx" ON "ContentCollection"("creatorId", "name");

CREATE TABLE "ContentCollectionAsset" (
  "collectionId" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentCollectionAsset_pkey" PRIMARY KEY ("collectionId", "contentId")
);
CREATE INDEX "ContentCollectionAsset_contentId_idx" ON "ContentCollectionAsset"("contentId");

CREATE TABLE "ContentTag" (
  "id" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentTag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContentTag_creatorId_name_key" ON "ContentTag"("creatorId", "name");
CREATE INDEX "ContentTag_creatorId_name_idx" ON "ContentTag"("creatorId", "name");

CREATE TABLE "ContentAssetTag" (
  "contentId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  CONSTRAINT "ContentAssetTag_pkey" PRIMARY KEY ("contentId", "tagId")
);
CREATE INDEX "ContentAssetTag_tagId_idx" ON "ContentAssetTag"("tagId");
CREATE INDEX "Content_creatorId_categoryId_idx" ON "Content"("creatorId", "categoryId");

ALTER TABLE "Content" ADD CONSTRAINT "Content_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentCategory" ADD CONSTRAINT "ContentCategory_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentCollection" ADD CONSTRAINT "ContentCollection_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentCollectionAsset" ADD CONSTRAINT "ContentCollectionAsset_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ContentCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentCollectionAsset" ADD CONSTRAINT "ContentCollectionAsset_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentTag" ADD CONSTRAINT "ContentTag_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentAssetTag" ADD CONSTRAINT "ContentAssetTag_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentAssetTag" ADD CONSTRAINT "ContentAssetTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ContentTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
