import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Eraser,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = 'Започнете да пишете...',
}) => {
  const [, setTick] = React.useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[200px] p-4 focus:outline-none text-foreground ' +
          '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 ' +
          '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 ' +
          '[&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 ' +
          '[&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground ' +
          '[&_a]:text-primary [&_a]:underline [&_hr]:my-4 [&_hr]:border-border',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      setTick(t => t + 1);
    },
    onSelectionUpdate: () => {
      setTick(t => t + 1);
    },
    onTransaction: () => {
      // Force a re-render so that buttons reflect active state immediately
      setTick(t => t + 1);
    },
  });

  // Sync external content changes (e.g. when loading a draft for editing)
  useEffect(() => {
    if (editor && content && editor.getHTML() !== content && !editor.isFocused) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;


  return (
    <div className="rounded-2xl border border-input bg-background flex flex-col">
      {/* Toolbar */}
      <TooltipProvider delayDuration={400}>
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1.5">
          {/* Undo / Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                pressed={false}
                className="hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200"
                onPressedChange={() => editor.chain().focus().undo().run()}
                onMouseDown={(e) => e.preventDefault()}
                disabled={!editor.can().undo()}
                aria-label="Undo"
              >
                <Undo className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Назад (Undo)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className="hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200"
                pressed={false}
                onPressedChange={() => editor.chain().focus().redo().run()}
                onMouseDown={(e) => e.preventDefault()}
                disabled={!editor.can().redo()}
                aria-label="Redo"
              >
                <Redo className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Напред (Redo)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Headings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className={cn(
                  "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
                  editor.isActive('heading', { level: 2 }) && "!bg-accent !text-zinc-950 shadow-sm"
                )}
                pressed={editor.isActive('heading', { level: 2 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Heading 2"
              >
                <Heading2 className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Заглавие 2</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className={cn(
                  "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
                  editor.isActive('heading', { level: 3 }) && "!bg-accent !text-zinc-950 shadow-sm"
                )}
                pressed={editor.isActive('heading', { level: 3 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Heading 3"
              >
                <Heading3 className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Заглавие 3</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Inline formatting */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className={cn(
                  "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
                  editor.isActive('bold') && "!bg-accent !text-zinc-950 shadow-sm"
                )}
                pressed={editor.isActive('bold')}
                onPressedChange={() => editor.chain().focus().toggleBold().run()}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Bold"
              >
                <Bold className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Удебелен текст</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className={cn(
                  "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
                  editor.isActive('italic') && "!bg-accent !text-zinc-950 shadow-sm"
                )}
                pressed={editor.isActive('italic')}
                onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Italic"
              >
                <Italic className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Курсив</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className={cn(
                  "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
                  editor.isActive('underline') && "!bg-accent !text-zinc-950 shadow-sm"
                )}
                pressed={editor.isActive('underline')}
                onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Underline"
              >
                <UnderlineIcon className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Подчертан</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className={cn(
                  "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
                  editor.isActive('strike') && "!bg-accent !text-zinc-950 shadow-sm"
                )}
                pressed={editor.isActive('strike')}
                onPressedChange={() => editor.chain().focus().toggleStrike().run()}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Strikethrough"
              >
                <Strikethrough className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Зачертан</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Lists */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className={cn(
                  "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
                  editor.isActive('bulletList') && "!bg-accent !text-zinc-950 shadow-sm"
                )}
                pressed={editor.isActive('bulletList')}
                onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Bullet list"
              >
                <List className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Списък</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className={cn(
                  "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
                  editor.isActive('orderedList') && "!bg-accent !text-zinc-950 shadow-sm"
                )}
                pressed={editor.isActive('orderedList')}
                onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Ordered list"
              >
                <ListOrdered className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Номериран списък</TooltipContent>
          </Tooltip>

          {/* Blockquote */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className={cn(
                  "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
                  editor.isActive('blockquote') && "!bg-accent !text-zinc-950 shadow-sm"
                )}
                pressed={editor.isActive('blockquote')}
                onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Blockquote"
              >
                <Quote className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Цитат</TooltipContent>
          </Tooltip>

          {/* Horizontal rule */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className="hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200"
                pressed={false}
                onPressedChange={() => {
                  // Capture current marks to restore them after inserting the line
                  const marks = editor.state.storedMarks || editor.state.selection.$from.marks();
                  editor.chain().focus().setHorizontalRule().run();
                  // If we had marks, re-apply them so formatting doesn't "restart"
                  if (marks && marks.length > 0) {
                    editor.view.dispatch(editor.state.tr.setStoredMarks(marks));
                  }
                }}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Horizontal rule"
              >
                <Minus className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Разделителна линия</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Alignment */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className={cn(
                  "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
                  editor.isActive({ textAlign: 'left' }) && "!bg-accent !text-zinc-950 shadow-sm"
                )}
                pressed={editor.isActive({ textAlign: 'left' })}
                onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Align left"
              >
                <AlignLeft className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Подравни отляво</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className={cn(
                  "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
                  editor.isActive({ textAlign: 'center' }) && "!bg-accent !text-zinc-950 shadow-sm"
                )}
                pressed={editor.isActive({ textAlign: 'center' })}
                onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Align center"
              >
                <AlignCenter className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Центрирай</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className={cn(
                  "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
                  editor.isActive({ textAlign: 'right' }) && "!bg-accent !text-zinc-950 shadow-sm"
                )}
                pressed={editor.isActive({ textAlign: 'right' })}
                onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Align right"
              >
                <AlignRight className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Подравни отдясно</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Clear formatting */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className="hover:bg-accent/20 hover:text-red-500 transition-all duration-200 focus:ring-red-500"
                pressed={false}
                onPressedChange={() => {
                  // Core clearing sequence
                  editor.chain()
                    .focus()
                    .unsetAllMarks()
                    .clearNodes()
                    .run();
                  
                  // Explicitly remove alignment
                  editor.commands.unsetTextAlign();
                  
                  // CRITICAL: Force clear all stored marks so the NEXT character typed is definitely plain
                  // This is the "restart" fix for middle of the line/end of line.
                  editor.view.dispatch(editor.state.tr.setStoredMarks([]));
                  
                  setTick(t => t + 1);
                }}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Reset all formatting"
              >
                <Eraser className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Изчисти форматирането</TooltipContent>
          </Tooltip>


        </div>
      </TooltipProvider>

      {/* Editor area with manual resize support */}
      <div className="relative resize-y overflow-auto min-h-[200px] max-h-[800px] flex-grow shadow-inner">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;
