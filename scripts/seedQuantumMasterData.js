const mongoose = require("mongoose");
require("dotenv").config();
const Parameter = require("../models/Parameter");
const ParameterMasterContent = require("../models/ParameterMasterContent");

const sampleParameters = [
  {
    code: "P001",
    name_en: "Blood Viscosity",
    name_hi: "रक्त की चिपचिपाहट (ब्लड विस्कोसिटी)",
    unit: "mPa.s",
    normal_min: 4.1,
    normal_max: 5.2,
    category: "Cardiovascular System",
    content: [
      {
        result_type: "HIGH",
        content_type: "PROBLEM",
        text_en: "Elevated blood viscosity increases peripheral vascular resistance and workload on the heart.",
        text_hi: "रक्त गाढ़ा होने से धमनियों में दबाव बढ़ता है और हृदय पर कार्यभार अधिक होता है।",
        priority: 1,
      },
      {
        result_type: "HIGH",
        content_type: "CAUSE",
        text_en: "Excessive intake of oily/heavy food, low daily hydration, lack of physical movement.",
        text_hi: "अधिक तला-भुना भोजन, कम पानी पीना और शारीरिक गतिविधि की कमी।",
        priority: 1,
      },
      {
        result_type: "HIGH",
        content_type: "PRECAUTION",
        text_en: "Drink at least 3 liters of warm water daily; engage in 30 mins brisk walking.",
        text_hi: "प्रतिदिन कम से कम 3 लीटर गुनगुना पानी पिएं और 30 मिनट टहलें।",
        priority: 1,
      },
      {
        result_type: "HIGH",
        content_type: "PATHYA",
        text_en: "Warm lukewarm water, green leafy vegetables, garlic, ginger tea, bottle gourd juice.",
        text_hi: "गुनगुना पानी, हरी पत्तेदार सब्जियां, लहसुन, अदरक की चाय, लौकी का रस।",
        priority: 1,
      },
      {
        result_type: "HIGH",
        content_type: "PARHEJ",
        text_en: "Avoid refined sugar, fried fast food, bakery items, cold water, excessive salt.",
        text_hi: "मैदा, तला हुआ भोजन, बेकरी उत्पाद, ठंडा पानी और अत्यधिक नमक से बचें।",
        priority: 1,
      },
      {
        result_type: "HIGH",
        content_type: "MEDICINE",
        text_en: "Arjunarishta 20ml twice daily after meals; Garlic pearls capsule.",
        text_hi: "अर्जुनारिष्ट 20 मि.ली. भोजन के बाद बराबर पानी मिलाकर; लसौन वटी।",
        priority: 1,
      },
      {
        result_type: "HIGH",
        content_type: "DIET",
        text_en: "Light vegetarian diet with barley, moong dal soup, fresh pomegranate.",
        text_hi: "हल्का सात्विक भोजन, जौ की रोटी, मूंग दाल का सूप और अनार।",
        priority: 1,
      },
    ],
  },
  {
    code: "P002",
    name_en: "Gastrointestinal Peristalsis",
    name_hi: "पाचन आंतों की गतिशीलता (पेरिस्टल्सिस)",
    unit: "index",
    normal_min: 3.5,
    normal_max: 4.8,
    category: "Digestive System",
    content: [
      {
        result_type: "LOW",
        content_type: "PROBLEM",
        text_en: "Sluggish intestinal movement causing chronic constipation and bloating.",
        text_hi: "आंतों की धीमी गति के कारण पुरानी कब्ज और पेट में अफरना।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "CAUSE",
        text_en: "Low dietary fiber, irregular eating times, suppression of natural urges, Agnimandya.",
        text_hi: "आहार में फाइबर की कमी, अनियमित भोजन का समय और अग्निमांद्य।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "PRECAUTION",
        text_en: "Take dinner before 8 PM; practice Vajrasana for 10 minutes post meals.",
        text_hi: "रात का खाना 8 बजे से पहले खाएं; भोजन के बाद 10 मिनट वज्रासन करें।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "PATHYA",
        text_en: "Triphala powder at bedtime with warm water, papaya, steamed vegetables, buttermilk.",
        text_hi: "रात को गुनगुने पानी से त्रिफला चूर्ण, पपीता, उबली सब्जियां, छाछ।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "PARHEJ",
        text_en: "Avoid raw lentils at night, stale food, tea/coffee on empty stomach.",
        text_hi: "रात में भारी दालें, बासी खाना और खाली पेट चाय/कॉफी से बचें।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "MEDICINE",
        text_en: "Abhayarishta 15ml twice daily; Avipattikar Churna 3g before meals.",
        text_hi: "अभयारिष्ट 15 मि.ली. दिन में दो बार; अविपत्तिकर चूर्ण 3 ग्राम।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "DIET",
        text_en: "High fiber oats, soaked figs/prunes, boiled spinach and cumin water.",
        text_hi: "फाइबर युक्त ओट्स, भीगी हुई अंजीर/मुनक्का, पालक और जीरा पानी।",
        priority: 1,
      },
    ],
  },
  {
    code: "P003",
    name_en: "Liver Fat Content",
    name_hi: "यकृत वसा (लिवर फैट संचय)",
    unit: "%",
    normal_min: 0.1,
    normal_max: 0.4,
    category: "Hepatobiliary System",
    content: [
      {
        result_type: "HIGH",
        content_type: "PROBLEM",
        text_en: "Hepatic fat accumulation (Fatty Liver Grade 1/2) leading to sluggish detox.",
        text_hi: "लिवर में अतिरिक्त चर्बी जमना (फैटी लिवर) जिससे विषैले तत्व साफ नहीं होते।",
        priority: 1,
      },
      {
        result_type: "HIGH",
        content_type: "CAUSE",
        text_en: "High intake of refined carbs, saturated fats, sedentary lifestyle, late night sleeping.",
        text_hi: "अधिक रिफाइंड कार्बोहाइड्रेट, वसायुक्त भोजन और देर रात तक जागना।",
        priority: 1,
      },
      {
        result_type: "HIGH",
        content_type: "PRECAUTION",
        text_en: "Avoid alcohol, sweet beverages, deep fried snacks; include daily Kapalbhati pranayama.",
        text_hi: "शराब, मीठे पेय और तले स्नैक्स से बचें; रोजाना कपालभाति प्राणायाम करें।",
        priority: 1,
      },
      {
        result_type: "HIGH",
        content_type: "PATHYA",
        text_en: "Amla juice, Giloy kwath, bitter gourd, turmeric milk (skimmed), flaxseeds.",
        text_hi: "आंवला रस, गिलोय क्वाथ, करेला, हल्दी दूध (मलाई रहित), अलसी।",
        priority: 1,
      },
      {
        result_type: "HIGH",
        content_type: "PARHEJ",
        text_en: "Avoid butter, ghee excess, red meat, cheese, carbonated soft drinks.",
        text_hi: "अत्यधिक मक्खन, घी, पनीर और कोल्ड ड्रिंक्स से पूरी तरह बचें।",
        priority: 1,
      },
      {
        result_type: "HIGH",
        content_type: "MEDICINE",
        text_en: "Arogyavardhini Vati 2 tablets twice daily; Liver Tonic Syrup 10ml twice daily.",
        text_hi: "आरोग्यवर्धिनी वटी 2 गोली सुबह-शाम; लिवर सिरप 10 मि.ली।",
        priority: 1,
      },
      {
        result_type: "HIGH",
        content_type: "DIET",
        text_en: "Dalia (broken wheat porridge), roasted chana, green tea, cucumber salad.",
        text_hi: "गेहूं का दलिया, भुना चना, ग्रीन टी और खीरे का सलाद।",
        priority: 1,
      },
    ],
  },
  {
    code: "P004",
    name_en: "Bone Mineral Density",
    name_hi: "अस्थि खनिज घनत्व (बोन मिनरल डेंसिटी)",
    unit: "g/cm²",
    normal_min: 0.8,
    normal_max: 1.2,
    category: "Skeletal System",
    content: [
      {
        result_type: "LOW",
        content_type: "PROBLEM",
        text_en: "Decreased bone calcium density (Osteopenia risk) causing joint weakness and backache.",
        text_hi: "हड्डियों में कैल्शियम की कमी (अस्थि दुर्बलता) जिससे जोड़ों में दर्द रहता है।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "CAUSE",
        text_en: "Deficiency of Vitamin D3, poor calcium absorption, excessive carbonated drink consumption.",
        text_hi: "विटामिन D3 व कैल्शियम की कमी और अधिक कोल्ड ड्रिंक्स का सेवन।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "PRECAUTION",
        text_en: "Spend 20 mins in morning sunlight daily; avoid heavy weight impact without guidance.",
        text_hi: "रोजाना सुबह 20 मिनट धूप सेंकें; जोड़ों पर अत्यधिक वजन न डालें।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "PATHYA",
        text_en: "Sesame seeds (til), cow milk, ragi porridge, almonds, lotus seed (makhana).",
        text_hi: "सफेद तिल, गाय का दूध, रागी का शीरा, बादाम और मखाना।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "PARHEJ",
        text_en: "Avoid caffeine overload, aerated drinks, excessive sour/acidic foods.",
        text_hi: "अत्यधिक चाय/कॉफी, कोल्ड ड्रिंक और अत्यधिक खट्टे खाद्य पदार्थों से बचें।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "MEDICINE",
        text_en: "Mukta Shukti Bhasma / Praval Pishti with milk; Hadjod tablet twice daily.",
        text_hi: "प्रवाल पिष्टी / मुक्ता शुक्ति भस्म दूध के साथ; हड़जोड़ वटी।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "DIET",
        text_en: "Ragi roti, roasted makhana snack, cow milk with ashwagandha at night.",
        text_hi: "रागी की रोटी, भुना मखाना, रात में अश्वगंधा युक्त गाय का दूध।",
        priority: 1,
      },
    ],
  },
  {
    code: "P005",
    name_en: "Pancreatic Insulin Secretion",
    name_hi: "अग्न्याशय इंसुलिन स्राव",
    unit: "μIU/mL",
    normal_min: 4.5,
    normal_max: 6.8,
    category: "Endocrine System",
    content: [
      {
        result_type: "LOW",
        content_type: "PROBLEM",
        text_en: "Insufficient pancreatic beta-cell insulin activity, raising blood glucose volatility.",
        text_hi: "अग्न्याशय से कम इंसुलिन स्राव होना जिससे रक्त शर्करा अनियंत्रित होती है।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "CAUSE",
        text_en: "Chronic stress, excessive sweet consumption, metabolic sluggishness, hereditary factors.",
        text_hi: "मानसिक तनाव, अत्यधिक मिठाई का सेवन और धीमी चयापचय दर।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "PRECAUTION",
        text_en: "Monitor fasting glucose weekly; do Mandukasana yoga daily for pancreas stimulation.",
        text_hi: "सप्ताह में एक बार खाली पेट शुगर जांचें; मांडूकासन योग नियमित करें।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "PATHYA",
        text_en: "Karela juice, Jamun seed powder, Fenugreek (methi) soaked water, Vijayasar kwath.",
        text_hi: "करेले का रस, जामुन गुठली चूर्ण, रात में भीगा मेथी पानी, विजयासार।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "PARHEJ",
        text_en: "Strictly avoid white sugar, sweets, white rice, mangoes, potatoes.",
        text_hi: "सफेद चीनी, मिठाइयां, सफेद चावल, आलू और मीठे फलों से परहेज करें।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "MEDICINE",
        text_en: "Chandraprabha Vati 2 tablets twice daily; Madhumehantak Churna 5g twice daily.",
        text_hi: "चंद्रप्रभावटी 2 गोली सुबह-शाम; मधुमेहंतक चूर्ण 5 ग्राम।",
        priority: 1,
      },
      {
        result_type: "LOW",
        content_type: "DIET",
        text_en: "Multigrain roti (barley+chana+wheat), sprouted moong, bitter gourd sabzi.",
        text_hi: "मल्टीग्रेन (जौ+चना+गेहूं) रोटी, अंकुरित मूंग, करेले की सब्जी।",
        priority: 1,
      },
    ],
  },
];

async function seed() {
  try {
    const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/uttkarsh_db";
    await mongoose.connect(mongoUrl, { dbName: "uttkarsh_db" });
    console.log("Connected to MongoDB for Quantum Master Data Seeding...");

    for (const p of sampleParameters) {
      const { content, ...paramData } = p;
      const param = await Parameter.findOneAndUpdate(
        { code: paramData.code },
        paramData,
        { upsert: true, new: true }
      );
      console.log(`Seeded Parameter: ${param.code} - ${param.name_en}`);

      for (const item of content) {
        await ParameterMasterContent.findOneAndUpdate(
          {
            parameter_id: param._id,
            result_type: item.result_type,
            content_type: item.content_type,
            priority: item.priority,
          },
          { ...item, parameter_id: param._id },
          { upsert: true }
        );
      }
    }

    console.log("✅ Quantum Master Data seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
