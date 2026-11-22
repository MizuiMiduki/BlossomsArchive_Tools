// src/App.tsx
import { lazy } from "solid-js";
import { createRouter } from "@solidjs/router";
import Layout from "./components/Layout";

const Home = lazy(() => import("./pages/Home"));
const Calculator = lazy(() => import("./pages/Calculator"));
const QrGenerator = lazy(() => import("./pages/QrGenerator"));
const PasswordGenerator = lazy(() => import("./pages/PasswordGenerator"));
const Lottery = lazy(() => import("./pages/Lottery"));
const ImageConverter = lazy(() => import("./pages/ImageConverter"));
const VideoCompressor = lazy(() => import("./pages/VideoCompressor"));
const CharsetConverter = lazy(() => import("./pages/CharsetConverter"));
const AccessInfo = lazy(() => import("./pages/AccessInfo"));
const OgpChecker = lazy(() => import("./pages/OgpChecker"));
const SeoChecker = lazy(() => import("./pages/SeoChecker"));
const ExifFrameGenerator = lazy(() => import("./pages/ExifFrameGenerator"));
const Clock = lazy(() => import("./pages/Clock"));
const TimerStopwatch = lazy(() => import("./pages/TimerStopwatch"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Credits = lazy(() => import("./pages/Credits"));
const HyperfocalCalculator = lazy(() => import("./pages/Hyperfocal"));
const HeadphoneDriveability = lazy(() => import("./pages/HeadphoneDriveability"));
const TextConverter = lazy(() => import("./pages/TextConverter"));
const ExposureCalculator = lazy(() => import("./pages/ExposureCalculator"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
        { path: "/exposure-calculator", component: ExposureCalculator },
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
