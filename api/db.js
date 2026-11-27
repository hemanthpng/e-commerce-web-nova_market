import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect Vercel Serverless environment
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isVercel ? path.join(os.tmpdir(), 'novamart_data') : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');
const SEED_FILE = path.join(__dirname, '..', 'data', 'store.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {
  // If directory creation fails in serverless, will operate in-memory
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function getInitialData() {
  const adminPass = hashPassword('admin123');
  const johnPass = hashPassword('customer123');
  const alicePass = hashPassword('alice123');
  const bobPass = hashPassword('bob123');

  const now = new Date().toISOString();

  return {
    settings: {
      allowPublicRegistration: true,
      requireAdminApproval: true
    },
    users: [
      {
        id: 'usr_admin',
        name: 'Store Administrator',
        email: 'admin@store.com',
        passwordHash: adminPass.hash,
        salt: adminPass.salt,
        role: 'admin',
        status: 'approved',
        phone: '+1 (555) 019-2834',
        address: { street: '100 Admin Plaza', city: 'San Francisco', state: 'CA', zip: '94105' },
        verificationToken: null,
        verifiedAt: now,
        rejectionReason: null,
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
      },
      {
        id: 'usr_john',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: johnPass.hash,
        salt: johnPass.salt,
        role: 'customer',
        status: 'approved',
        phone: '+1 (555) 234-5678',
        address: { street: '742 Evergreen Terrace', city: 'Springfield', state: 'IL', zip: '62704' },
        verificationToken: null,
        verifiedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        rejectionReason: null,
        createdAt: new Date(Date.now() - 12 * 86400000).toISOString()
      },
      {
        id: 'usr_alice',
        name: 'Alice Walker',
        email: 'alice@example.com',
        passwordHash: alicePass.hash,
        salt: alicePass.salt,
        role: 'customer',
        status: 'pending_approval',
        phone: '+1 (555) 876-5432',
        address: { street: '404 Innovation Way', city: 'Austin', state: 'TX', zip: '78701' },
        verificationToken: 'tok_alice_verify_2026',
        verifiedAt: null,
        rejectionReason: null,
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
      },
      {
        id: 'usr_bob',
        name: 'Bob Miller',
        email: 'bob@example.com',
        passwordHash: bobPass.hash,
        salt: bobPass.salt,
        role: 'customer',
        status: 'pending_approval',
        phone: '+1 (555) 345-6789',
        address: { street: '12 Blossom Lane', city: 'Seattle', state: 'WA', zip: '98101' },
        verificationToken: 'tok_bob_verify_2026',
        verifiedAt: null,
        rejectionReason: null,
        createdAt: new Date(Date.now() - 4 * 3600000).toISOString()
      }
    ],
    categories: [
      {
            "id": "cat_electronics",
            "name": "Electronics & Gadgets",
            "slug": "electronics",
            "description": "Keyboards, gaming mice, fast chargers, and computing accessories.",
            "icon": "Cpu"
      },
      {
            "id": "cat_wearables",
            "name": "Wearables & Watches",
            "slug": "wearables",
            "description": "Smartwatches, fitness bands, smart health rings, and connected devices.",
            "icon": "Watch"
      },
      {
            "id": "cat_audio",
            "name": "Audio & Sound",
            "slug": "audio",
            "description": "ANC headphones, true wireless earbuds, portable speakers, and soundbars.",
            "icon": "Headphones"
      },
      {
            "id": "cat_fashion",
            "name": "Fashion & Apparel",
            "slug": "fashion",
            "description": "Designer apparel, luxury footwear, duffels, and accessories.",
            "icon": "Shirt"
      },
      {
            "id": "cat_home",
            "name": "Home & Kitchen",
            "slug": "home-living",
            "description": "Minimalist lighting, aroma diffusers, and coffee makers.",
            "icon": "Home"
      },
      {
            "id": "cat_beauty",
            "name": "Beauty & Wellness",
            "slug": "beauty",
            "description": "Organic skincare, restorative serums, and personal care.",
            "icon": "Sparkles"
      },
      {
            "id": "cat_sports",
            "name": "Sports & Outdoors",
            "slug": "sports",
            "description": "Running shoes, fitness gear, and yoga accessories.",
            "icon": "Activity"
      }
],
    products: [
      {
            "id": "prod_1",
            "name": "AuraPulse ANC Wireless Headphones",
            "categoryId": "cat_audio",
            "categoryName": "Audio & Sound",
            "price": 2999,
            "stock": 35,
            "rating": 4.8,
            "reviewCount": 42,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-1/800/800",
            "description": "High-fidelity audio with hybrid active noise cancellation, 40-hour battery life, and spatial surround sound.",
            "specs": [
                  "Bluetooth 5.3",
                  "40hr Battery Life",
                  "40mm Neodymium Drivers",
                  "USB-C Fast Charge"
            ]
      },
      {
            "id": "prod_audio_2",
            "name": "BassBeats Foldable Wireless On-Ear Headphones",
            "categoryId": "cat_audio",
            "categoryName": "Audio & Sound",
            "price": 899,
            "stock": 45,
            "rating": 4.7,
            "reviewCount": 64,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-2/800/800",
            "description": "Deep bass wireless on-ear headphones with soft cushioned earcups, built-in mic, and 30-hour battery life.",
            "specs": [
                  "Extra Bass Sound",
                  "30hr Playtime",
                  "Built-in HD Mic",
                  "Foldable Compact Design"
            ]
      },
      {
            "id": "prod_audio_3",
            "name": "StudioPro Audiophile Over-Ear Studio Headphones",
            "categoryId": "cat_audio",
            "categoryName": "Audio & Sound",
            "price": 1599,
            "stock": 25,
            "rating": 4.9,
            "reviewCount": 38,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-3/800/800",
            "description": "Studio-grade monitoring headphones with 50mm dynamic drivers, detachable braided cable, and noise isolation.",
            "specs": [
                  "50mm Neodymium Drivers",
                  "Passive Noise Isolation",
                  "Detachable 3.5mm/6.3mm Cable",
                  "Memory Foam Cushions"
            ]
      },
      {
            "id": "prod_audio_4",
            "name": "RogueX RGB Gaming Headphone with Boom Microphone",
            "categoryId": "cat_audio",
            "categoryName": "Audio & Sound",
            "price": 1299,
            "stock": 30,
            "rating": 4.8,
            "reviewCount": 51,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-4/800/800",
            "description": "7.1 surround sound gaming headset with flexible noise-cancelling boom mic, breathable ear cushions, and dynamic RGB lighting.",
            "specs": [
                  "7.1 Surround Sound",
                  "Noise-Cancelling Boom Mic",
                  "RGB Dynamic Lighting",
                  "Multi-Platform (PC/PS5/Xbox/Mobile)"
            ]
      },
      {
            "id": "prod_audio_5",
            "name": "SonicFit Magnetic Sport Neckband Earphones",
            "categoryId": "cat_audio",
            "categoryName": "Audio & Sound",
            "price": 499,
            "stock": 60,
            "rating": 4.6,
            "reviewCount": 78,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-5/800/800",
            "description": "Lightweight wireless neckband with magnetic earbuds, IPX5 sweat resistance, and instant fast pairing.",
            "specs": [
                  "Magnetic Earbuds",
                  "IPX5 Sweat & Water Resistant",
                  "20hr Fast Charge",
                  "Bluetooth 5.2"
            ]
      },
      {
            "id": "prod_2",
            "name": "Horizon Pro Smartwatch Ultra",
            "categoryId": "cat_wearables",
            "categoryName": "Wearables & Watches",
            "price": 4499,
            "stock": 20,
            "rating": 4.9,
            "reviewCount": 38,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-6/800/800",
            "description": "Aerospace-grade chassis, always-on sapphire AMOLED display, advanced ECG, and dual-frequency GPS.",
            "specs": [
                  "Durable Case",
                  "100m Water Resistant",
                  "ECG & SpO2 Monitoring",
                  "7-Day Battery"
            ]
      },
      {
            "id": "prod_3",
            "name": "ZenMechanical RGB Pro Keyboard",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 3299,
            "stock": 18,
            "rating": 4.7,
            "reviewCount": 29,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-7/800/800",
            "description": "Hot-swappable mechanical switches, CNC machined aluminum case, sound dampening foam, and per-key RGB.",
            "specs": [
                  "Mechanical Switches",
                  "Hot-Swappable",
                  "PBT Keycaps",
                  "Triple-Mode Wireless"
            ]
      },
      {
            "id": "prod_4",
            "name": "Voyager Heritage Leather Duffel",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 2499,
            "stock": 15,
            "rating": 4.9,
            "reviewCount": 19,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-8/800/800",
            "description": "Handcrafted full-grain leather duffel bag with antique brass hardware and waterproof shoe compartment.",
            "specs": [
                  "Full-Grain Leather",
                  "45L Capacity",
                  "Separate Shoe Tunnel",
                  "Heavy-Duty Brass Zippers"
            ]
      },
      {
            "id": "prod_5",
            "name": "AeroGlide Carbon Running Shoes",
            "categoryId": "cat_sports",
            "categoryName": "Sports & Outdoors",
            "price": 3999,
            "stock": 24,
            "rating": 4.6,
            "reviewCount": 31,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-9/800/800",
            "description": "Propulsive carbon plate embedded in dual-density nitrogen-infused supercritical foam for maximum energy return.",
            "specs": [
                  "Carbon Plate",
                  "Ultra-Light 210g",
                  "Breathable Matrix Mesh",
                  "Durable Rubber Grip"
            ]
      },
      {
            "id": "prod_6",
            "name": "Nordic Minimalist Desk Lamp",
            "categoryId": "cat_home",
            "categoryName": "Home & Living",
            "price": 1499,
            "stock": 40,
            "rating": 4.7,
            "reviewCount": 16,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-10/800/800",
            "description": "Architectural desk lamp with stepless touch dimming, color temperature tuning (2700K-6500K), and integrated Qi wireless charger base.",
            "specs": [
                  "Touch Dimmer",
                  "Wireless Fast Charging",
                  "CRI > 95 True Color",
                  "Aluminum Alloy"
            ]
      },
      {
            "id": "prod_7",
            "name": "Artisan Ceramic Pour-Over Set",
            "categoryId": "cat_home",
            "categoryName": "Home & Living",
            "price": 999,
            "stock": 28,
            "rating": 4.8,
            "reviewCount": 22,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-11/800/800",
            "description": "Double-walled ceramic dripper with borosilicate server and precision thermal spiral extraction ribs.",
            "specs": [
                  "Handmade Ceramic",
                  "600ml Server",
                  "Heat Resistant Borosilicate",
                  "Dishwasher Safe"
            ]
      },
      {
            "id": "prod_8",
            "name": "Botanical Radiance Restorative Serum",
            "categoryId": "cat_beauty",
            "categoryName": "Beauty & Wellness",
            "price": 799,
            "stock": 50,
            "rating": 4.9,
            "reviewCount": 54,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-12/800/800",
            "description": "Potent botanical complex infused with niacinamide, multi-molecular hyaluronic acid, and cold-pressed squalane.",
            "specs": [
                  "30ml Bottle",
                  "100% Vegan",
                  "Fragrance-Free",
                  "Dermatologist Tested"
            ]
      },
      {
            "id": "prod_9",
            "name": "HyperSpeed Wireless Gaming Mouse",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 1899,
            "stock": 45,
            "rating": 4.8,
            "reviewCount": 56,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-13/800/800",
            "description": "Ultra-lightweight ergonomic wireless gaming mouse with 26,000 DPI optical sensor, RGB lighting, and 80-hour battery life.",
            "specs": [
                  "26K DPI Sensor",
                  "1ms Ultra-Low Latency",
                  "68g Lightweight",
                  "USB-C Fast Charging"
            ]
      },
      {
            "id": "prod_10",
            "name": "SonicBoom Portable Bluetooth Speaker",
            "categoryId": "cat_audio",
            "categoryName": "Audio & Sound",
            "price": 2499,
            "stock": 30,
            "rating": 4.7,
            "reviewCount": 44,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-14/800/800",
            "description": "Powerful 360-degree stereo sound with deep bass punch, IPX7 waterproof rating, and 24-hour battery life for outdoor adventures.",
            "specs": [
                  "IPX7 Waterproof",
                  "24-Hour Battery",
                  "BassBoost Drivers",
                  "True Wireless Stereo"
            ]
      },
      {
            "id": "prod_11",
            "name": "PowerCore 20,000mAh 65W Fast Power Bank",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 1999,
            "stock": 40,
            "rating": 4.9,
            "reviewCount": 72,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-15/800/800",
            "description": "High-capacity power bank with 65W Power Delivery fast charging for smartphones, tablets, and mobile devices.",
            "specs": [
                  "20,000mAh Capacity",
                  "65W PD Fast Charge",
                  "LED Digital Display",
                  "Triple Device Output"
            ]
      },
      {
            "id": "prod_12",
            "name": "PureComfort Heavyweight Cotton Hoodie",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 1799,
            "stock": 35,
            "rating": 4.8,
            "reviewCount": 38,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-16/800/800",
            "description": "Premium 400 GSM brushed fleece oversized hoodie crafted from 100% combed organic cotton with reinforced stitching.",
            "specs": [
                  "400 GSM Cotton",
                  "Brushed Fleece Interior",
                  "Pre-Shrunk Fabric",
                  "Kangaroo Pocket"
            ]
      },
      {
            "id": "prod_13",
            "name": "Classic Chelsea Handcrafted Suede Boots",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 3499,
            "stock": 18,
            "rating": 4.9,
            "reviewCount": 27,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-17/800/800",
            "description": "Timeless Chelsea silhouette made with rich water-resistant suede, cushioned insole, and durable non-slip crepe rubber sole.",
            "specs": [
                  "Genuine Suede",
                  "Elastic Side Panels",
                  "Memory Foam Insole",
                  "Anti-Slip Outsole"
            ]
      },
      {
            "id": "prod_14",
            "name": "Aviator Titanium Polarized Sunglasses",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 1299,
            "stock": 50,
            "rating": 4.7,
            "reviewCount": 31,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-18/800/800",
            "description": "Ultra-light titanium frame with 100% UV400 polarized HD lenses that eliminate glare while providing crystal-clear vision.",
            "specs": [
                  "UV400 Protection",
                  "Polarized Triacetate Lenses",
                  "Titanium Alloy Frame",
                  "Anti-Scratch Coating"
            ]
      },
      {
            "id": "prod_15",
            "name": "ZenAroma Ultrasonic Oil Diffuser",
            "categoryId": "cat_home",
            "categoryName": "Home & Living",
            "price": 1199,
            "stock": 28,
            "rating": 4.8,
            "reviewCount": 49,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-19/800/800",
            "description": "Whisper-quiet ultrasonic humidifier and aromatherapy diffuser with 7 ambient LED mood lights and auto shut-off.",
            "specs": [
                  "500ml Reservoir",
                  "Whisper Quiet < 20dB",
                  "7 LED Mood Colors",
                  "Timer Auto Shut-Off"
            ]
      },
      {
            "id": "prod_16",
            "name": "ErgoRest Orthopedic Memory Foam Pillow",
            "categoryId": "cat_home",
            "categoryName": "Home & Living",
            "price": 1499,
            "stock": 32,
            "rating": 4.7,
            "reviewCount": 63,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-20/800/800",
            "description": "Ergonomically contoured cervical support pillow with cooling gel infusion and breathable bamboo washable cover.",
            "specs": [
                  "Contoured Neck Support",
                  "Cooling Gel Infusion",
                  "Bamboo Fiber Cover",
                  "Hypoallergenic"
            ]
      },
      {
            "id": "prod_17",
            "name": "French Press Double-Wall Coffee Maker",
            "categoryId": "cat_home",
            "categoryName": "Home & Living",
            "price": 1699,
            "stock": 22,
            "rating": 4.9,
            "reviewCount": 35,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-21/800/800",
            "description": "304 food-grade stainless steel double-walled insulated French press that keeps brew hot for 3 hours with 4-level filtration.",
            "specs": [
                  "1000ml (34oz)",
                  "Double-Wall Thermal Insulation",
                  "4-Stage Filter Screen",
                  "304 Stainless Steel"
            ]
      },
      {
            "id": "prod_18",
            "name": "ProFit All-in-One Resistance Bands Set",
            "categoryId": "cat_sports",
            "categoryName": "Sports & Outdoors",
            "price": 899,
            "stock": 60,
            "rating": 4.8,
            "reviewCount": 85,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-22/800/800",
            "description": "11-piece workout set with 5 stackable resistance tubes (up to 150 lbs total), foam handles, ankle straps, and door anchor.",
            "specs": [
                  "Up to 150 lbs Resistance",
                  "Natural Latex Tubes",
                  "Includes Door Anchor & Bag",
                  "Full-Body Workout Guide"
            ]
      },
      {
            "id": "prod_19",
            "name": "GripMaster Non-Slip Eco Yoga Mat",
            "categoryId": "cat_sports",
            "categoryName": "Sports & Outdoors",
            "price": 1399,
            "stock": 25,
            "rating": 4.9,
            "reviewCount": 41,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-23/800/800",
            "description": "High-density 6mm cushioned TPE dual-layer yoga mat with laser-etched body alignment lines and non-slip textured grip.",
            "specs": [
                  "6mm High Density TPE",
                  "Laser Alignment Lines",
                  "100% Non-Toxic & Eco-Friendly",
                  "Free Carry Strap"
            ]
      },
      {
            "id": "prod_20",
            "name": "AyurVeda Cold-Pressed Hair Care Elixir",
            "categoryId": "cat_beauty",
            "categoryName": "Beauty & Wellness",
            "price": 649,
            "stock": 70,
            "rating": 4.9,
            "reviewCount": 94,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-24/800/800",
            "description": "Traditional blend of Rosemary, Bhringraj, Amla, and Virgin Coconut oil that deeply nourishes roots and promotes hair density.",
            "specs": [
                  "200ml Glass Bottle",
                  "100% Pure & Cold-Pressed",
                  "No Mineral Oils or Silicones",
                  "Ayurvedic Recipe"
            ]
      },
      {
            "id": "prod_21",
            "name": "Apex Pulse Pro AMOLED Fitness Band",
            "categoryId": "cat_wearables",
            "categoryName": "Wearables & Watches",
            "price": 1899,
            "stock": 45,
            "rating": 4.7,
            "reviewCount": 64,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-25/800/800",
            "description": "Vibrant 1.47-inch curved AMOLED display, continuous SpO2 oxygen and heart rate monitoring, 14-day battery, and 5ATM water resistance.",
            "specs": [
                  "1.47\" AMOLED Display",
                  "14-Day Battery Life",
                  "5ATM Water Resistant",
                  "120 Sports Modes"
            ]
      },
      {
            "id": "prod_22",
            "name": "Titan Wave Bluetooth Calling Smartwatch",
            "categoryId": "cat_wearables",
            "categoryName": "Wearables & Watches",
            "price": 2499,
            "stock": 30,
            "rating": 4.8,
            "reviewCount": 51,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-26/800/800",
            "description": "Ultra-clear 1.96\" HD display with Bluetooth calling, built-in AI voice assistant, metal bezel finish, and 100+ customizable watch faces.",
            "specs": [
                  "Bluetooth HD Calling",
                  "1.96\" Full-Touch Screen",
                  "AI Voice Assistant",
                  "IP68 Dust & Water Proof"
            ]
      },
      {
            "id": "prod_23",
            "name": "Aura Ring Smart Health & Sleep Tracker",
            "categoryId": "cat_wearables",
            "categoryName": "Wearables & Watches",
            "price": 3799,
            "stock": 25,
            "rating": 4.9,
            "reviewCount": 33,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-27/800/800",
            "description": "Aerospace titanium smart ring tracking sleep stages, skin temperature fluctuations, recovery index, and HRV in an ultra-discreet lightweight profile.",
            "specs": [
                  "Aerospace Titanium",
                  "24/7 Temperature & HRV",
                  "7-Day Battery",
                  "Water Resistant to 50m"
            ]
      },
      {
            "id": "prod_24",
            "name": "PodMax Active Spatial ANC Earbuds",
            "categoryId": "cat_audio",
            "categoryName": "Audio & Sound",
            "price": 1999,
            "stock": 50,
            "rating": 4.8,
            "reviewCount": 89,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-28/800/800",
            "description": "45dB active noise cancelling with transparency mode, 10mm dynamic titanium drivers, quad ENC microphones, and 36-hour total battery.",
            "specs": [
                  "45dB Hybrid ANC",
                  "36hr Total Playtime",
                  "Wireless Charging",
                  "Quad Mic ENC"
            ]
      },
      {
            "id": "prod_25",
            "name": "BassPro Cinema 120W Dolby Soundbar",
            "categoryId": "cat_audio",
            "categoryName": "Audio & Sound",
            "price": 4499,
            "stock": 18,
            "rating": 4.9,
            "reviewCount": 47,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-29/800/800",
            "description": "Immersive 120W peak power 2.1 channel TV soundbar with dedicated wired subwoofer, HDMI ARC, Optical input, and multi-EQ cinema modes.",
            "specs": [
                  "120W Peak Output",
                  "Deep Bass Subwoofer",
                  "HDMI ARC & Optical",
                  "Bluetooth 5.3"
            ]
      },
      {
            "id": "prod_26",
            "name": "Classic Combed Cotton Crewneck T-Shirt",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 199,
            "stock": 80,
            "rating": 4.6,
            "reviewCount": 112,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-30/800/800",
            "description": "100% combed breathable cotton everyday crewneck t-shirt. Pre-shrunk bio-washed fabric for all-day comfort.",
            "specs": [
                  "100% Breathable Cotton",
                  "Pre-Shrunk Bio-Washed",
                  "Ribbed Crew Collar",
                  "Regular Everyday Fit"
            ]
      },
      {
            "id": "prod_27",
            "name": "Regular Fit Pique Solid Polo T-Shirt",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 279,
            "stock": 65,
            "rating": 4.7,
            "reviewCount": 94,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-31/800/800",
            "description": "Smart casual polo shirt crafted from breathable honeycomb pique cotton blend with ribbed collar and button placket.",
            "specs": [
                  "Durable Honeycomb Pique",
                  "2-Button Placket",
                  "Anti-Pilling Finish",
                  "Machine Washable"
            ]
      },
      {
            "id": "prod_28",
            "name": "Vintage Graphic Print Oversized Tee",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 249,
            "stock": 50,
            "rating": 4.8,
            "reviewCount": 78,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-32/800/800",
            "description": "Urban streetwear graphic printed t-shirt with relaxed drop shoulder fit and premium screenprinted typography.",
            "specs": [
                  "180 GSM Heavy Fabric",
                  "Distressed Screenprint",
                  "Drop Shoulder Fit",
                  "Soft Handfeel"
            ]
      },
      {
            "id": "prod_29",
            "name": "Dry-Fit Athletic Stretch Training T-Shirt",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 229,
            "stock": 70,
            "rating": 4.6,
            "reviewCount": 63,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-33/800/800",
            "description": "Lightweight moisture-wicking active training tee designed with 4-way stretch fabric to keep you cool and dry.",
            "specs": [
                  "Sweat-Wicking Poly-Spandex",
                  "4-Way Stretch",
                  "Reflective Chest Decal",
                  "Quick-Dry Tech"
            ]
      },
      {
            "id": "prod_30",
            "name": "Retro Pocket 400-in-1 Handheld Game Console",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 299,
            "stock": 90,
            "rating": 4.9,
            "reviewCount": 142,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-34/800/800",
            "description": "Pocket-sized retro game box with 400 built-in vintage 8-bit classic arcade games, 3.0-inch color screen, and TV cable connector.",
            "specs": [
                  "400 Classic 8-Bit Games",
                  "3.0\" Color LCD",
                  "AV TV Output Cable Included",
                  "Rechargeable 1020mAh Battery"
            ]
      },
      {
            "id": "prod_31",
            "name": "SpeedGlide Extended XXL RGB Gaming Mousepad",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 329,
            "stock": 45,
            "rating": 4.7,
            "reviewCount": 88,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-35/800/800",
            "description": "Full-desk extended gaming mousepad with micro-textured precision cloth surface and stitched anti-fray borders.",
            "specs": [
                  "800x300mm Desktop Coverage",
                  "Micro-Textured Speed Cloth",
                  "Non-Slip Natural Rubber Base",
                  "Anti-Fray Stitched Edges"
            ]
      },
      {
            "id": "prod_32",
            "name": "FastCharge 3-in-1 Braided Multi-USB Cable",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 299,
            "stock": 120,
            "rating": 4.8,
            "reviewCount": 95,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-36/800/800",
            "description": "Heavy-duty braided universal charging cable with Type-C, Lightning, and Micro-USB connectors for multi-device powering.",
            "specs": [
                  "Type-C + Lightning + Micro USB",
                  "66W Fast Charging",
                  "Military-Grade Braided Nylon",
                  "Tangle-Free 1.2m Length"
            ]
      },
      {
            "id": "prod_33",
            "name": "AeroLight Breathable Mesh Running Sneakers",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 349,
            "stock": 60,
            "rating": 4.8,
            "reviewCount": 130,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-37/800/800",
            "description": "Ultra-lightweight mesh running and walking shoes with cushioned impact absorption sole and breathable knit body.",
            "specs": [
                  "Air-Mesh Upper",
                  "Shock-Absorbing EVA Midsole",
                  "Anti-Skid Traction Pattern",
                  "Ultralight 180g"
            ]
      },
      {
            "id": "prod_34",
            "name": "Casual Slip-On Canvas Loafers",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 379,
            "stock": 45,
            "rating": 4.7,
            "reviewCount": 74,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-38/800/800",
            "description": "Versatile low-profile slip-on casual shoes made of breathable washed canvas with cushioned insole and flexible rubber outsole.",
            "specs": [
                  "Sturdy Washed Canvas",
                  "Memory Foam Footbed",
                  "Elastic Side Gores",
                  "Vulcanized Rubber Outsole"
            ]
      },
      {
            "id": "prod_35",
            "name": "CloudComfort Ergonomic Slide Sandals",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 249,
            "stock": 85,
            "rating": 4.8,
            "reviewCount": 109,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-39/800/800",
            "description": "Super soft, waterproof molded slide sandals with contoured footbed for post-workout recovery and daily relaxation.",
            "specs": [
                  "One-Piece High-Density EVA",
                  "Arch Support Contour",
                  "Waterproof & Quick-Drying",
                  "Textured Anti-Slip Grip"
            ]
      },
      {
            "id": "prod_36",
            "name": "Retro Street Low-Top Skate Sneakers",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 389,
            "stock": 55,
            "rating": 4.7,
            "reviewCount": 82,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-40/800/800",
            "description": "Classic retro lace-up street sneakers with padded ankle support, dual-tone accent stripes, and grippy gum rubber sole.",
            "specs": [
                  "Padded Collar & Tongue",
                  "Reinforced Toe Bumper",
                  "Flat Cotton Laces",
                  "Flexible Cupsole"
            ]
      },
      {
            "id": "prod_37",
            "name": "GlowFire USB Desktop RGB Condenser Gaming Microphone",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 349,
            "stock": 65,
            "rating": 4.7,
            "reviewCount": 38,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-41/800/800",
            "description": "Plug-and-play USB condenser microphone with dynamic RGB illumination, tap-to-mute button, and crystal-clear voice pickup for streaming, Discord, and multiplayer gaming.",
            "specs": [
                  "Cardioid Pickup Pattern",
                  "RGB Gradient Lighting",
                  "Tap-to-Mute Sensor",
                  "Zero-Latency 3.5mm Jack"
            ]
      },
      {
            "id": "prod_38",
            "name": "HyperGrip 2.4GHz Wireless Silent Gaming Mouse",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 349,
            "stock": 90,
            "rating": 4.8,
            "reviewCount": 82,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-42/800/800",
            "description": "Ergonomic wireless gaming mouse featuring silent optical switches, 3200 DPI adjustable optical sensor, and rechargeable lithium battery.",
            "specs": [
                  "3200 DPI Adjustable Sensor",
                  "Ultra-Quiet Click Switches",
                  "Rechargeable 500mAh Battery",
                  "7-Color Breathing LED"
            ]
      },
      {
            "id": "prod_39",
            "name": "DualTrigger Universal Mobile Gaming Controller Grips",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 299,
            "stock": 120,
            "rating": 4.6,
            "reviewCount": 54,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-43/800/800",
            "description": "Mechanical L1/R1 responsive trigger grips for Android and iPhone. Highly sensitive capacitive silicone pads for BGMI, Call of Duty, and PUBG Mobile.",
            "specs": [
                  "Conductive Alloy Triggers",
                  "Zero Latency Mechanical Click",
                  "Universal Phone Clamp",
                  "Ergonomic Matte Grip"
            ]
      },
      {
            "id": "prod_40",
            "name": "StrikeBass 3.5mm Low-Latency In-Ear Gaming Earphones",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 349,
            "stock": 75,
            "rating": 4.7,
            "reviewCount": 46,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-44/800/800",
            "description": "Precision in-ear gaming earphones with dual microphones (detachable boom mic + inline mic), 10mm dynamic drivers, and memory foam noise-isolating ear tips.",
            "specs": [
                  "Dual Microphones",
                  "10mm Bass Drivers",
                  "L-Shaped 3.5mm Gold-Plated Jack",
                  "Tangle-Free Braided Wire"
            ]
      },
      {
            "id": "prod_41",
            "name": "AeroBreeze USB Portable RGB Cooling Fan",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 299,
            "stock": 85,
            "rating": 4.5,
            "reviewCount": 29,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-45/800/800",
            "description": "Compact 3-speed desktop cooling fan with flexible 360-degree rotation and multi-color LED glow. Keeps your gaming setup cool and stylish.",
            "specs": [
                  "3 Speed Settings",
                  "Whisper Quiet < 25dB",
                  "USB-Powered 5V",
                  "360-Degree Adjustable Angle"
            ]
      },
      {
            "id": "prod_42",
            "name": "Retro Arcade Brick Game Pocket Console (99 in 1)",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 199,
            "stock": 140,
            "rating": 4.7,
            "reviewCount": 110,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-46/800/800",
            "description": "Classic nostalgic handheld brick game console featuring 99 retro puzzle games including Tank, Racing, and Brick Shooter with sound effects.",
            "specs": [
                  "99 Built-in Classic Games",
                  "High-Contrast LCD Display",
                  "Requires 2x AA Batteries",
                  "Ultra-Portable Lightweight Body"
            ]
      },
      {
            "id": "prod_43",
            "name": "CyberHub 4-Port High-Speed USB 3.0 Splitter",
            "categoryId": "cat_electronics",
            "categoryName": "Electronics & Gadgets",
            "price": 329,
            "stock": 95,
            "rating": 4.8,
            "reviewCount": 63,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-47/800/800",
            "description": "Sleek aluminum 4-port USB 3.0 data hub with individual LED power switches and 5Gbps transfer speeds for keyboard, mouse, and game controllers.",
            "specs": [
                  "4x USB 3.0 5Gbps Ports",
                  "Individual Power Switches with LEDs",
                  "Plug & Play (Windows/Mac/Linux)",
                  "Overcurrent Protection"
            ]
      },
      {
            "id": "prod_44",
            "name": "FlexStep Ultralight Gym & Walking Shoes",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 349,
            "stock": 95,
            "rating": 4.8,
            "reviewCount": 114,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-48/800/800",
            "description": "Vibrant lightweight athletic running shoes with breathable mesh upper, cushioned shock-absorbing EVA midsole, and high-traction rubber outsole.",
            "specs": [
                  "Breathable Flyknit Mesh",
                  "Ultra-Light 280g Weight",
                  "Anti-Skid Flex Outsole",
                  "Shock-Absorbing Insole"
            ]
      },
      {
            "id": "prod_45",
            "name": "UrbanPace Breathable Knit Slip-On Sneakers",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 369,
            "stock": 80,
            "rating": 4.7,
            "reviewCount": 78,
            "featured": true,
            "image": "https://picsum.photos/seed/novamart-seed-49/800/800",
            "description": "Contemporary slip-on casual sneakers engineered with memory foam insoles, elastic sock collars for easy on-off, and all-day street walking comfort.",
            "specs": [
                  "Memory Foam Cushioned Sole",
                  "Stretch Elastic Collar",
                  "Machine Washable",
                  "Durable Rubber Tread"
            ]
      },
      {
            "id": "prod_46",
            "name": "AirCushion Athletic Running Shoes with Anti-Slip Grip",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 389,
            "stock": 70,
            "rating": 4.8,
            "reviewCount": 92,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-50/800/800",
            "description": "Pro athletic running shoes with visible heel air cushioning, reinforced toe bumper, and sweat-wicking lining for morning runs and workouts.",
            "specs": [
                  "Heel Air Cushion Unit",
                  "Reinforced Toe Guard",
                  "Sweat-Wicking Inner Lining",
                  "Reflective Night Strips"
            ]
      },
      {
            "id": "prod_47",
            "name": "SpeedPro Lightweight Road Running Trainers",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 329,
            "stock": 110,
            "rating": 4.6,
            "reviewCount": 65,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-51/800/800",
            "description": "Dynamic multi-color street trainers with high-abrasion grooved rubber sole, padded tongue, and supportive arch cup.",
            "specs": [
                  "Grooved Anti-Slip Tread",
                  "Padded Ankle Collar",
                  "High Energy Return Midsole",
                  "Lace-Up Closure"
            ]
      },
      {
            "id": "prod_48",
            "name": "WaveRide Comfort EVA Foam Slide Sandals",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 229,
            "stock": 130,
            "rating": 4.7,
            "reviewCount": 145,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-52/800/800",
            "description": "Waterproof, ultra-soft molded EVA recovery slides with ergonomic arch support and textured footbed for beach, casual indoor/outdoor lounging.",
            "specs": [
                  "100% Waterproof EVA Foam",
                  "Contoured Arch Support",
                  "Anti-Slip Wave Tread",
                  "Non-Chafing Wide Strap"
            ]
      },
      {
            "id": "prod_49",
            "name": "StreetFlex Classic Canvas Court Sneakers",
            "categoryId": "cat_fashion",
            "categoryName": "Fashion & Apparel",
            "price": 359,
            "stock": 85,
            "rating": 4.8,
            "reviewCount": 88,
            "featured": false,
            "image": "https://picsum.photos/seed/novamart-seed-53/800/800",
            "description": "Timeless low-profile vulcanized canvas sneakers with metal eyelets, contrast white stitching, and signature gum rubber waffle sole.",
            "specs": [
                  "100% Breathable Cotton Canvas",
                  "Vulcanized Gum Rubber Sole",
                  "Metal Eyelets",
                  "Cushioned Ortho Insole"
            ]
      }
],
    orders: [
      {
        id: 'ORD-9821',
        customerId: 'usr_john',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        items: [
          {
            productId: 'prod_1',
            name: 'AuraPulse ANC Wireless Headphones',
            price: 2999,
            quantity: 1,
            image: 'https://picsum.photos/seed/novamart-seed-54/800/800'
          }
        ],
        subtotal: 2999,
        shippingFee: 0,
        tax: 539.82,
        totalAmount: 3538.82,
        shippingAddress: {
          name: 'John Doe',
          street: 'B-402, Lotus Towers, MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          zip: '560001',
          country: 'India'
        },
        paymentMethod: 'Credit Card',
        paymentStatus: 'completed',
        paymentId: 'PAY-882194',
        orderStatus: 'delivered',
        trackingNumber: 'TRK-US-991283',
        deliveryPartner: 'FedEx Express',
        trackingHistory: [
          { status: 'placed', timestamp: new Date(Date.now() - 5 * 86400000).toISOString(), note: 'Order placed successfully by customer.', location: 'Online' },
          { status: 'confirmed', timestamp: new Date(Date.now() - 5 * 86400000 + 120000).toISOString(), note: 'Payment processed and verified by Payment Gateway.', location: 'Payment Gateway' },
          { status: 'processing', timestamp: new Date(Date.now() - 4 * 86400000).toISOString(), note: 'Items packed and labeled at Central Fulfillment Hub.', location: 'Warehouse A1' },
          { status: 'shipped', timestamp: new Date(Date.now() - 3 * 86400000).toISOString(), note: 'Package handed over to carrier.', location: 'Chicago Sorting Center' },
          { status: 'out_for_delivery', timestamp: new Date(Date.now() - 2 * 86400000).toISOString(), note: 'Courier on the way to delivery address.', location: 'Springfield Hub' },
          { status: 'delivered', timestamp: new Date(Date.now() - 2 * 86400000 + 14400000).toISOString(), note: 'Package signed and delivered at front porch.', location: 'Springfield, IL' }
        ],
        createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString()
      }
    ],
    payments: [
      {
        id: 'PAY-882194',
        orderId: 'ORD-9821',
        customerId: 'usr_john',
        customerName: 'John Doe',
        amount: 269.99,
        paymentMethod: 'Credit Card (ending in 4242)',
        gatewayRef: 'GW_TXN_9918237192',
        status: 'success',
        createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
      }
    ],
    reviews: [
      {
        id: 'rev_1',
        productId: 'prod_1',
        customerId: 'usr_john',
        customerName: 'John Doe',
        rating: 5,
        comment: 'Outstanding quality and active noise cancellation. Very comfortable for long sessions.',
        verifiedPurchase: true,
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString()
      }
    ],
    emails: [
      {
        id: 'eml_1',
        to: 'alice@example.com',
        subject: 'Account Registration Received - Pending Admin Approval',
        type: 'admin_approval_request',
        recipientName: 'Alice Walker',
        status: 'sent',
        body: `<div style="font-family:sans-serif;padding:24px;background:#f8fafc;color:#1e293b;">
          <h2 style="color:#2563eb;">Welcome to NovaMart, Alice!</h2>
          <p>Thank you for creating an account. In accordance with security policy, our store administrator is currently reviewing your registration.</p>
          <div style="background:#e0f2fe;border-left:4px solid #0284c7;padding:12px;margin:16px 0;">
            <strong>Verification Status:</strong> PENDING MANUAL ADMIN APPROVAL
          </div>
          <p>You will receive an email confirmation as soon as your account is approved.</p>
        </div>`,
        sentAt: new Date(Date.now() - 2 * 86400000).toISOString()
      }
    ]
  };
}

class Database {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.settings) {
          this.data.settings = {
            allowPublicRegistration: true,
            requireAdminApproval: true
          };
          this.save();
        }
      } else {
        this.data = getInitialData();
        this.save();
      }
    } catch {
      this.data = getInitialData();
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch {
      // In serverless environments where file write is restricted, state remains in memory
    }
  }

  // Users
  getUsers() { return this.data.users; }
  getUserById(id) { return this.data.users.find(u => u.id === id); }
  getUserByEmail(email) { return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()); }
  getUserByToken(token) { return this.data.users.find(u => u.verificationToken === token); }
  
  addUser(user) {
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(id, updates) {
    const index = this.data.users.findIndex(u => u.id === id);
    if (index === -1) return null;
    this.data.users[index] = { ...this.data.users[index], ...updates };
    this.save();
    return this.data.users[index];
  }

  deleteUser(id) {
    this.data.users = this.data.users.filter(u => u.id !== id);
    this.save();
  }

  // Categories
  getCategories() { return this.data.categories; }
  getCategoryById(id) { return this.data.categories.find(c => c.id === id); }
  addCategory(cat) {
    this.data.categories.push(cat);
    this.save();
    return cat;
  }
  updateCategory(id, updates) {
    const index = this.data.categories.findIndex(c => c.id === id);
    if (index === -1) return null;
    this.data.categories[index] = { ...this.data.categories[index], ...updates };
    this.save();
    return this.data.categories[index];
  }
  deleteCategory(id) {
    this.data.categories = this.data.categories.filter(c => c.id !== id);
    this.save();
  }

  // Products
  getProducts() { return this.data.products; }
  getProductById(id) { return this.data.products.find(p => p.id === id); }
  addProduct(prod) {
    this.data.products.unshift(prod);
    this.save();
    return prod;
  }
  updateProduct(id, updates) {
    const index = this.data.products.findIndex(p => p.id === id);
    if (index === -1) return null;
    this.data.products[index] = { ...this.data.products[index], ...updates };
    this.save();
    return this.data.products[index];
  }
  deleteProduct(id) {
    this.data.products = this.data.products.filter(p => p.id !== id);
    this.data.reviews = (this.data.reviews || []).filter(r => r.productId !== id);
    this.save();
  }

  // Orders
  getOrders() { return this.data.orders; }
  getOrderById(id) { return this.data.orders.find(o => o.id === id); }
  getOrdersByCustomer(customerId) { return this.data.orders.filter(o => o.customerId === customerId); }
  addOrder(order) {
    this.data.orders.unshift(order);
    this.save();
    return order;
  }
  updateOrder(id, updates) {
    const index = this.data.orders.findIndex(o => o.id === id);
    if (index === -1) return null;
    this.data.orders[index] = { ...this.data.orders[index], ...updates };
    this.save();
    return this.data.orders[index];
  }

  // Payments
  getPayments() { return this.data.payments; }
  getPaymentById(id) { return this.data.payments.find(p => p.id === id); }
  addPayment(payment) {
    this.data.payments.unshift(payment);
    this.save();
    return payment;
  }
  updatePayment(id, updates) {
    const index = this.data.payments.findIndex(p => p.id === id);
    if (index === -1) return null;
    this.data.payments[index] = { ...this.data.payments[index], ...updates };
    this.save();
    return this.data.payments[index];
  }

  // Reviews
  getReviews(productId) {
    if (!productId) return this.data.reviews;
    return this.data.reviews.filter(r => r.productId === productId);
  }
  addReview(review) {
    this.data.reviews.unshift(review);
    const prodReviews = this.data.reviews.filter(r => r.productId === review.productId);
    const avg = prodReviews.reduce((sum, r) => sum + r.rating, 0) / prodReviews.length;
    this.updateProduct(review.productId, {
      rating: parseFloat(avg.toFixed(1)),
      reviewCount: prodReviews.length
    });
    this.save();
    return review;
  }

  // Emails
  getEmails() { return this.data.emails; }
  addEmail(email) {
    this.data.emails.unshift(email);
    this.save();
    return email;
  }

  // Store Settings
  getSettings() {
    if (!this.data.settings) {
      this.data.settings = {
        allowPublicRegistration: true,
        requireAdminApproval: true
      };
    }
    return this.data.settings;
  }
  updateSettings(updates) {
    this.data.settings = { ...this.getSettings(), ...updates };
    this.save();
    return this.data.settings;
  }
}

export const db = new Database();
export { hashPassword };
