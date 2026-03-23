import { DropZone } from '../components/upload/DropZone';
import { FileList } from '../components/upload/FileList';
import { MetadataForm } from '../components/upload/MetadataForm';

export function UploadView() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: File Upload */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-semibold text-satsang-bark mb-2">
            Upload Your Episode
          </h1>
          <p className="text-satsang-ash">
            Select your MP3 files and arrange them in the order they should be stitched.
          </p>
        </div>

        <DropZone />
        <FileList />
      </div>

      {/* Right Column: Metadata & CTA */}
      <div className="lg:col-span-1">
        <MetadataForm />
      </div>
    </div>
  );
}
