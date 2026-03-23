import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useEpisodeStore } from '../../store/episodeStore';
import { FileListItem } from './FileListItem';

export function FileList() {
  const files = useEpisodeStore((state) => state.files);
  const reorderFiles = useEpisodeStore((state) => state.reorderFiles);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8,
    } as any),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = files.findIndex((f) => f.id === active.id);
      const newIndex = files.findIndex((f) => f.id === over.id);

      const newOrder = arrayMove(files, oldIndex, newIndex);
      reorderFiles(newOrder.map((f) => f.id));
    }
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-satsang-bark mb-4">
        Files to Stitch ({files.length})
      </h2>
      <p className="text-satsang-ash text-sm mb-4">
        👇 Drag to reorder • Files will be stitched in this order
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={files.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {files.map((audioFile, index) => (
              <FileListItem
                key={audioFile.id}
                audioFile={audioFile}
                index={index}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
