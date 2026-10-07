import React from 'react'
import Card from './components/Card'

const App = () => {
  return (
    <div className='parent'>
      <Card user='Roushani' age={18} img='https://girldp.net/wp-content/uploads/2025/08/anime-girl-dp-1.webp' />
      <Card user='Priyanshi' age={19} img='https://th.bing.com/th/id/OIP.2UhBOLzZmWiLOHfICrIrJAHaNK?r=0&o=7rm=3&rs=1&pid=ImgDetMain&o=7&rm=3' />
      <Card user='Muskan Keshri' age={22} img='https://i.pinimg.com/originals/d2/42/43/d242438bd47c88c117d5b7ce7217068f.jpg?nii=t' />
      <Card user='Antra' age={17} img='https://tse1.mm.bing.net/th/id/OIP._8FoS9vqO7OzHyvv4b4HTAAAAA?r=0&w=474&h=842&rs=1&pid=ImgDetMain&o=7&rm=3' />
    </div>
  )
}

export default App