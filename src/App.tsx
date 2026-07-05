// src/App.tsx
import { Router, Route } from "@solidjs/router";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Calculator from "./pages/Calculator";
import QrGenerator from "./pages/QrGenerator";
import PasswordGenerator from "./pages/PasswordGenerator";
import Lottery from "./pages/Lottery";
import ImageConverter from "./pages/ImageConverter";
import AccessInfo from "./pages/AccessInfo";
import ExifFrameGenerator from "./pages/ExifFrameGenerator";
import Clock from "./pages/Clock";
import TimerStopwatch from "./pages/TimerStopwatch";
import PrivacyPolicy from "./pages/PrivacyPolicy";

function App() {
    return (
        <Router root={Layout}>
            <Route path="/" component={Home} />
            <Route path="/calculator" component={Calculator} />
            <Route path="/qr" component={QrGenerator} />
            <Route path="/password" component={PasswordGenerator} />
            <Route path="/lottery" component={Lottery} />
            <Route path="/image-conversion" component={ImageConverter} />
            <Route path="/access-info" component={AccessInfo} />
            <Route path="/exif-frame" component={ExifFrameGenerator} />
            <Route path="/clock" component={Clock} />
            <Route path="/timer" component={TimerStopwatch} />
            <Route path="/privacy" component={PrivacyPolicy} />
        </Router>
    );
}

export default App;
