import { useEffect } from 'react'
import { Workbench } from './components/Workbench'
import { createWorkspaceStorage } from './persistence/workspaceStorage'

const workspaceStorage = createWorkspaceStorage()

export default function App() {
  useEffect(() => {
    document.title = '动效预览台'
  }, [])

  return <Workbench storage={workspaceStorage} />
}
