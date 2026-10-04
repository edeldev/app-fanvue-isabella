CREATE TABLE "ContentTemplateAsset" (
    "templateId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentTemplateAsset_pkey" PRIMARY KEY ("templateId", "contentId")
);

CREATE UNIQUE INDEX "ContentTemplateAsset_templateId_position_key" ON "ContentTemplateAsset"("templateId", "position");
CREATE INDEX "ContentTemplateAsset_contentId_idx" ON "ContentTemplateAsset"("contentId");

ALTER TABLE "ContentTemplateAsset" ADD CONSTRAINT "ContentTemplateAsset_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentTemplateAsset" ADD CONSTRAINT "ContentTemplateAsset_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
