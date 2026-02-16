import AntigravityLogo from '@/assets/icons/ide/antigravity.svg';
import CursorLogo from '@/assets/icons/ide/cursor.svg';
import VscodeLogo from '@/assets/icons/ide/vscode.svg';
import WindsurfLogo from '@/assets/icons/ide/windsurf.svg';

const iconProps = {
  style: { height: '14px', width: 'auto' },
};

export const Ide = {
  antigravity: {
    icon: <AntigravityLogo {...iconProps} />,
    name: 'Antigravity',
    uriScheme: 'antigravity',
  },
  cursor: {
    icon: <CursorLogo {...iconProps} />,
    name: 'Cursor',
    uriScheme: 'cursor',
  },
  vscode: {
    icon: <VscodeLogo {...iconProps} />,
    name: 'VSCode',
    uriScheme: 'vscode',
  },
  windsurf: {
    icon: <WindsurfLogo {...iconProps} />,
    name: 'Windsurf',
    uriScheme: 'windsurf',
  },
};
