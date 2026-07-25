import { useEffect } from 'react'
import { Workbench } from './components/Workbench'

export default function App() {
  useEffect(() => {
    document.title = '动效预览台'
  }, [])

  return <Workbench />
}
