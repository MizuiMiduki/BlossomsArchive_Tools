// src/App.tsx
import { createRouter } from "@solidjs/router";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Calculator from "./pages/Calculator";
import QrGenerator from "./pages/QrGenerator";
import PasswordGenerator from "./pages/PasswordGenerator";
import Lottery from "./pages/Lottery";
import ImageConverter from "./pages/ImageConverter";
import VideoCompressor from "./pages/VideoCompressor";
import AccessInfo from "./pages/AccessInfo";
import OgpChecker from "./pages/OgpChecker";
import SeoChecker from "./pages/SeoChecker";
import ExifFrameGenerator from "./pages/ExifFrameGenerator";
import Clock from "./pages/Clock";
import TimerStopwatch from "./pages/TimerStopwatch";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Credits from "./pages/Credits";
import HyperfocalCalculator from "./pages/Hyperfocal";
import HeadphoneDriveability from "./pages/HeadphoneDriveability";
import TextConverter from "./pages/TextConverter";
import CharsetConverter from "./pages/CharsetConverter";
import NotFound from "./pages/NotFound";

export const Router = createRouter({
    routes: [
        { path: "/", component: Home },
        { path: "/calculator", component: Calculator },
        { path: "/qr_code", component: QrGenerator },
        { path: "/password-generator", component: PasswordGenerator },
        { path: "/lottery", component: Lottery },
        { path: "/image_conversion", component: ImageConverter },
        { path: "/video-compressor", component: VideoCompressor },
        { path: "/charset-converter", component: CharsetConverter },
        { path: "/access-info", component: AccessInfo },
        { path: "/ogp-checker", component: OgpChecker },
        { path: "/seo-checker", component: SeoChecker },
        { path: "/exif-frame", component: ExifFrameGenerator },
        { path: "/clock", component: Clock },
        { path: "/timer", component: TimerStopwatch },
        { path: "/privacy", component: PrivacyPolicy },
        { path: "/credits", component: Credits },
        { path: "/hyperfocal", component: HyperfocalCalculator },
        { path: "/headphone-driveability", component: HeadphoneDriveability },
        { path: "/text-converter", component: TextConverter },
        { path: "*", component: NotFound },
    ],
});

function App() {
    return (
        <Router>
            {(props) => <Layout>{props.children}</Layout>}
        </Router>
    );
}

export default App;
