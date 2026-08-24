const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const envConfig = require("../config/environment.json");
Object.entries(envConfig).forEach(([key, value]) => {
  process.env[key] = value;
});

const Parameter = require("../models/Parameter");
const ParameterMasterContent = require("../models/ParameterMasterContent");
const { parseContent } = require("../services/contentParser");

const sampleParameters = [
  {
    code: "P001",
    name_en: "Blood Viscosity",
    name_hi: "रक्त की चिपचिपाहट (ब्लड विस्कोसिटी)",
    unit: "mPa.s",
    normal_min: 4.1,
    normal_max: 5.2,
    category: "Cardiovascular System",
    description: "Measures blood thickness and resistance to flow across coronary vessels.",
    raw_content_en: `1. Definition & Health Problems Identified
* Elevated blood viscosity increases peripheral vascular resistance and workload on the heart.
* High viscosity makes blood flow sluggish through microcapillaries.

2. Possible Causes & Factors
* Excessive intake of oily/heavy food, low daily hydration, lack of physical movement.
  * Habitual tobacco smoking or nicotine use.
  * Elevated serum lipids and high blood sugar levels.

3. Precautions & Lifestyle Rules (Pathya / Parhej)
* Drink at least 3 liters of warm water daily; engage in 30 mins brisk walking.
* Pathya: Warm lukewarm water, green leafy vegetables, garlic, ginger tea, bottle gourd juice.
* Parhej: Avoid refined sugar, fried fast food, bakery items, cold water, excessive salt.

4. Recommended Ayurvedic Formulations
* Arjunarishta 20ml twice daily after meals with equal water.
* Garlic Pearls / Lasunadi Vati 1 tablet twice daily.
* Light vegetarian diet with barley, moong dal soup, fresh pomegranate.`,
    raw_content_hi: `1. परिभाषा एवं स्वास्थ्य समस्याएं
* रक्त गाढ़ा होने से धमनियों में दबाव बढ़ता है और हृदय पर कार्यभार अधिक होता है।
* सूक्ष्म नलिकाओं में रक्त प्रवाह धीमा हो जाता है।

2. संभावित कारण
* अधिक तला-भुना भोजन, कम पानी पीना और शारीरिक गतिविधि की कमी।
  * नियमित धूम्रपान या तंबाकू का सेवन।
  * कोलेस्ट्रॉल व रक्त शर्करा में असंतुलन।

3. सावधानियां एवं नियम (पथ्य / परहेज)
* प्रतिदिन कम से कम 3 लीटर गुनगुना पानी पिएं और 30 मिनट टहलें।
* पथ्य: गुनगुना पानी, हरी पत्तेदार सब्जियां, लहसुन, अदरक की चाय, लौकी का रस।
* परहेज: मैदा, तला हुआ भोजन, बेकरी उत्पाद, ठंडा पानी और अत्यधिक नमक से बचें।

4. आयुर्वेदिक उपचार एवं आहार
* अर्जुनारिष्ट 20 मि.ली. भोजन के बाद बराबर पानी मिलाकर; लसौन वटी।
* हल्का सात्विक भोजन, जौ की रोटी, मूंग दाल का सूप और अनार।`,
  },
  {
    code: "P002",
    name_en: "Gastrointestinal Peristalsis",
    name_hi: "पाचन आंतों की गतिशीलता (पेरिस्टल्सिस)",
    unit: "index",
    normal_min: 3.5,
    normal_max: 4.8,
    category: "Digestive System",
    description: "Evaluates intestinal motility and digestive transit speed.",
    raw_content_en: `1. Clinical Health Problems
* Sluggish intestinal movement causing chronic constipation and bloating.
* Impaired nutrient absorption and accumulation of digestive toxins (Ama).

2. Underlying Causes
* Low dietary fiber, irregular eating times, suppression of natural urges, Agnimandya.
  * Inadequate fluid intake throughout the day.
  * Stress and lack of daily abdominal movement.

3. Precautions & Dietary Guidelines
* Take dinner before 8 PM; practice Vajrasana for 10 minutes post meals.
* Pathya: Triphala powder at bedtime with warm water, papaya, steamed vegetables, buttermilk.
* Parhej: Avoid raw lentils at night, stale food, tea/coffee on empty stomach.

4. Ayurvedic Medicine Suggestions
* Abhayarishta 15ml twice daily; Avipattikar Churna 3g before meals.
* High fiber oats, soaked figs/prunes, boiled spinach and cumin water.`,
    raw_content_hi: `1. मुख्य समस्याएं
* आंतों की धीमी गति के कारण पुरानी कब्ज और पेट में अफरना।
* पाचन अग्नि मंद होना और आमदोष का संचय।

2. संभावित कारण
* आहार में फाइबर की कमी, अनियमित भोजन का समय और अग्निमांद्य।
  * दिनभर में कम पानी पीना।
  * मानसिक तनाव और शारीरिक निष्क्रियता।

3. सावधानियां व आहार सारणी
* रात का खाना 8 बजे से पहले खाएं; भोजन के बाद 10 मिनट वज्रासन करें।
* पथ्य: रात को गुनगुने पानी से त्रिफला चूर्ण, पपीता, उबली सब्जियां, छाछ।
* परहेज: रात में भारी दालें, बासी खाना और खाली पेट चाय/कॉफी से बचें।

4. आयुर्वेदिक उपचार
* अभयारिष्ट 15 मि.ली. दिन में दो बार; अविपत्तिकर चूर्ण 3 ग्राम।
* फाइबर युक्त ओट्स, भीगी हुई अंजीर/मुनक्का, पालक और जीरा पानी।`,
  },
  {
    code: "P003",
    name_en: "Liver Fat Content",
    name_hi: "यकृत वसा (लिवर फैट संचय)",
    unit: "%",
    normal_min: 0.1,
    normal_max: 0.4,
    category: "Hepatobiliary System",
    description: "Evaluates hepatic lipid accumulation and liver detoxification efficiency.",
    raw_content_en: `1. Hepatic Finding
* Hepatic fat accumulation (Fatty Liver Grade 1/2) leading to sluggish detox.
* Elevated liver enzyme stress and metabolic fatigue.

2. Primary Contributing Factors
* High intake of refined carbs, saturated fats, sedentary lifestyle, late night sleeping.
  * Frequent consumption of sugary carbonated beverages.

3. Precautions & Lifestyle Rules
* Avoid alcohol, sweet beverages, deep fried snacks; include daily Kapalbhati pranayama.
* Pathya: Amla juice, Giloy kwath, bitter gourd, turmeric milk (skimmed), flaxseeds.
* Parhej: Avoid butter, ghee excess, red meat, cheese, carbonated soft drinks.

4. Ayurvedic Liver Support
* Arogyavardhini Vati 2 tablets twice daily; Liver Tonic Syrup 10ml twice daily.
* Dalia (broken wheat porridge), roasted chana, green tea, cucumber salad.`,
    raw_content_hi: `1. यकृत संबंधी समस्याएं
* लिवर में अतिरिक्त चर्बी जमना (फैटी लिवर) जिससे विषैले तत्व साफ नहीं होते।
* उपापचय दर में गिरावट और भारीपन।

2. प्रमुख कारण
* अधिक रिफाइंड कार्बोहाइड्रेट, वसायुक्त भोजन और देर रात तक जागना।
  * मीठे पेय पदार्थों का अधिक सेवन।

3. सावधानियां एवं परहेज
* शराब, मीठे पेय और तले स्नैक्स से बचें; रोजाना कपालभाति प्राणायाम करें।
* पथ्य: आंवला रस, गिलोय क्वाथ, करेला, हल्दी दूध (मलाई रहित), अलसी।
* परहेज: अत्यधिक मक्खन, घी, पनीर और कोल्ड ड्रिंक्स से पूरी तरह बचें।

4. आयुर्वेदिक चिकित्सा
* आरोग्यवर्धिनी वटी 2 गोली सुबह-शाम; लिवर सिरप 10 मि.ली।
* गेहूं का दलिया, भुना चना, ग्रीन टी और खीरे का सलाद।`,
  },
  {
    code: "P004",
    name_en: "Bone Mineral Density",
    name_hi: "अस्थि खनिज घनत्व (बोन मिनरल डेंसिटी)",
    unit: "g/cm²",
    normal_min: 0.8,
    normal_max: 1.2,
    category: "Skeletal System",
    description: "Evaluates bone calcium concentration and osteopenia risks.",
    raw_content_en: `1. Skeletal Health Problems
* Decreased bone calcium density (Osteopenia risk) causing joint weakness and backache.
* Fragility and stiffness in weight-bearing joints.

2. Contributing Factors
* Deficiency of Vitamin D3, poor calcium absorption, excessive carbonated drink consumption.
  * Inadequate morning sunlight exposure.

3. Precautions & Bone Nutrition
* Spend 20 mins in morning sunlight daily; avoid heavy weight impact without guidance.
* Pathya: Sesame seeds (til), cow milk, ragi porridge, almonds, lotus seed (makhana).
* Parhej: Avoid caffeine overload, aerated drinks, excessive sour/acidic foods.

4. Ayurvedic Mineral Replenishment
* Mukta Shukti Bhasma / Praval Pishti with milk; Hadjod tablet twice daily.
* Ragi roti, roasted makhana snack, cow milk with ashwagandha at night.`,
    raw_content_hi: `1. अस्थि दुर्बलता समस्याएं
* हड्डियों में कैल्शियम की कमी (अस्थि दुर्बलता) जिससे जोड़ों में दर्द रहता है।
* जोड़ों में जकड़न और कमजोरी।

2. मुख्य कारण
* विटामिन D3 व कैल्शियम की कमी और अधिक कोल्ड ड्रिंक्स का सेवन।
  * धूप की कमी।

3. सावधानियां व आहार
* रोजाना सुबह 20 मिनट धूप सेंकें; जोड़ों पर अत्यधिक वजन न डालें।
* पथ्य: सफेद तिल, गाय का दूध, रागी का शीरा, बादाम और मखाना।
* परहेज: अत्यधिक चाय/कॉफी, कोल्ड ड्रिंक और अत्यधिक खट्टे खाद्य पदार्थों से बचें।

4. आयुर्वेदिक उपचार
* प्रवाल पिष्टी / मुक्ता शुक्ति भस्म दूध के साथ; हड़जोड़ वटी।
* रागी की रोटी, भुना मखाना, रात में अश्वगंधा युक्त गाय का दूध।`,
  },
  {
    code: "P005",
    name_en: "Pancreatic Insulin Secretion",
    name_hi: "अग्न्याशय इंसुलिन स्राव",
    unit: "μIU/mL",
    normal_min: 4.5,
    normal_max: 6.8,
    category: "Endocrine System",
    description: "Measures pancreatic beta-cell endocrine response and glycemic regulation.",
    raw_content_en: `1. Endocrine Finding
* Insufficient pancreatic beta-cell insulin activity, raising blood glucose volatility.
* Metabolic sluggishness and post-prandial fatigue.

2. Underlying Factors
* Chronic stress, excessive sweet consumption, metabolic sluggishness, hereditary factors.
  * Sedentary work habits and irregular sleep cycles.

3. Precautions & Ayurvedic Lifestyle
* Monitor fasting glucose weekly; do Mandukasana yoga daily for pancreas stimulation.
* Pathya: Karela juice, Jamun seed powder, Fenugreek (methi) soaked water, Vijayasar kwath.
* Parhej: Strictly avoid white sugar, sweets, white rice, mangoes, potatoes.

4. Ayurvedic Glucose Management
* Chandraprabha Vati 2 tablets twice daily; Madhumehantak Churna 5g twice daily.
* Multigrain roti (barley+chana+wheat), sprouted moong, bitter gourd sabzi.`,
    raw_content_hi: `1. अंतःस्रावी समस्याएं
* अग्न्याशय से कम इंसुलिन स्राव होना जिससे रक्त शर्करा अनियंत्रित होती है।
* भोजन के बाद अत्यधिक थकान व सुस्ती।

2. प्रमुख कारण
* मानसिक तनाव, अत्यधिक मिठाई का सेवन और धीमी चयापचय दर।
  * शारीरिक गतिहीनता और अनियमित दिनचर्या।

3. सावधानियां व पथ्य-परहेज
* सप्ताह में एक बार खाली पेट शुगर जांचें; मांडूकासन योग नियमित करें।
* पथ्य: करेले का रस, जामुन गुठली चूर्ण, रात में भीगा मेथी पानी, विजयासार।
* परहेज: सफेद चीनी, मिठाइयां, सफेद चावल, आलू और मीठे फलों से परहेज करें।

4. आयुर्वेदिक उपचार
* चंद्रप्रभावटी 2 गोली सुबह-शाम; मधुमेहंतक चूर्ण 5 ग्राम।
* मल्टीग्रेन (जौ+चना+गेहूं) रोटी, अंकुरित मूंग, करेले की सब्जी।`,
  },
];

async function seed() {
  try {
    const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/uttkarsh_db";
    await mongoose.connect(mongoUrl, { dbName: "uttkarsh_db" });
    console.log("Connected to MongoDB for Quantum Master Data Seeding...");

    for (const p of sampleParameters) {
      const parsed_nodes_en = parseContent(p.raw_content_en, "en");
      const parsed_nodes_hi = parseContent(p.raw_content_hi, "hi");

      const param = await Parameter.findOneAndUpdate(
        { code: p.code },
        {
          ...p,
          parsed_nodes_en,
          parsed_nodes_hi,
          version: 1,
          version_history: [
            {
              version: 1,
              raw_content_en: p.raw_content_en,
              raw_content_hi: p.raw_content_hi,
              parsed_nodes_en,
              parsed_nodes_hi,
              updated_at: new Date(),
              change_summary: "Initial seed version",
            },
          ],
          status: "PUBLISHED",
          is_active: true,
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Seeded Parameter: ${param.code} - ${param.name_en} (${parsed_nodes_en.length} EN nodes, ${parsed_nodes_hi.length} HI nodes)`);
    }

    console.log("🎉 Quantum Master Data seeding complete with rich AST content!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
