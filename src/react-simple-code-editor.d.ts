declare module 'react-simple-code-editor' {
  import * as React from 'react';

  interface EditorProps {
    value: string;
    onValueChange: (value: string) => void;
    highlight: (code: string) => string;
    padding?: number | string;
    className?: string;
    textareaClassName?: string;
    style?: React.CSSProperties;
    tabSize?: number;
    insertSpaces?: boolean;
    ignoreTabKey?: boolean;
    placeholder?: string;
    disabled?: boolean;
    preClassName?: string;
    textareaId?: string;
    autoFocus?: boolean;
    onFocus?: React.FocusEventHandler<HTMLTextAreaElement>;
    onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
    onKeyUp?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  }

  const Editor: React.FC<EditorProps>;
  export default Editor;
}
