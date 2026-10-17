import { entry as ApiRequest } from './ApiRequest';
import { entry as ArchitectureMap } from './ArchitectureMap';
import { entry as BrowserFrame } from './BrowserFrame';
import { entry as DataTable } from './DataTable';
import { entry as DiffCard } from './DiffCard';
import { entry as ErrorTrace } from './ErrorTrace';
import { entry as FileTree } from './FileTree';
import { entry as GitGraph } from './GitGraph';
import { entry as JsonViewer } from './JsonViewer';
import { entry as KeyboardShortcut } from './KeyboardShortcut';
import { entry as PhoneFrame } from './PhoneFrame';
import type { ComponentEntry } from './registry';
import { entry as StackLayers } from './StackLayers';
import { entry as Terminal } from './Terminal';

/** Grupo C2 do arsenal: componentes de desenvolvimento e tecnologia. */
export const groupC2: Record<string, ComponentEntry> = {
  Terminal,
  BrowserFrame,
  PhoneFrame,
  FileTree,
  ApiRequest,
  ErrorTrace,
  KeyboardShortcut,
  GitGraph,
  StackLayers,
  ArchitectureMap,
  DataTable,
  JsonViewer,
  DiffCard,
};
