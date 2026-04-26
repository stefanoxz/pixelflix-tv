import Highlights from "./Highlights";

// Index é apenas um alias para Highlights — o chrome (Header + BottomNav)
// é injetado pelo `WithChrome` no App.tsx, igual ao /live, /movies, etc.
const Index = () => <Highlights />;

export default Index;
