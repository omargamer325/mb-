# شطرنج أونلاين - Chess Online

منصة شطرنج متقدمة أونلاين تشبه Chess.com - اللعب ضد لاعبين حقيقيين من جميع أنحاء العالم.

## المميزات

### الحسابات والمصادقة
- **تسجيل حساب جديد** - اسم مستخدم وكلمة مرور
- **تسجيل الدخول** - JWT للمصادقة الآمنة
- **ملف تعريف** - عرض اسم المستخدم وتصنيف ELO

### اللعب أونلاين
- **قائمة انتظار** - ابحث عن خصم تلقائياً
- **مباريات حية** - لعب ضد لاعبين حقيقيين
- **مزامنة فورية** - Socket.io للتحديث الفوري

### قواعد الشطرنج الكاملة
- جميع الحركات القانونية
- تبييت (Castling)
- أخذ بالمرور (En passant)
- ترقية البيدق إلى وزير
- كش وكش ملك واستسلام

### تصنيف ELO
- بداية 1200 نقطة
- تحديث بعد كل مباراة (±15)

## التشغيل

### 1. تثبيت المتطلبات
```bash
npm install
```

### 2. تشغيل السيرفر
```bash
npm start
```

### 3. فتح الموقع
افتح المتصفح على: **http://localhost:3000**

## البنية

```
chess-website/
├── server/           # Backend
│   ├── index.js      # Express + Socket.io
│   ├── database.js   # SQLite
│   ├── gameManager.js # Matchmaking + Game logic
│   └── routes/
│       └── auth.js   # Register/Login API
├── public/           # Frontend
│   ├── index.html    # اللوبي واللعبة
│   ├── login.html    # تسجيل الدخول
│   ├── styles.css
│   ├── chess.js      # لوحة الشطرنج
│   ├── app.js        # تطبيق اللعب أونلاين
│   └── auth.js       # مصادقة
└── package.json
```

## التقنيات

- **Backend**: Node.js, Express, Socket.io
- **Database**: SQLite (better-sqlite3)
- **Auth**: JWT, bcryptjs
- **Frontend**: HTML, CSS, Vanilla JavaScript

## للاختبار مع لاعبين

1. افتح نافذتين في المتصفح (أو جهازين)
2. سجّل حسابين مختلفين
3. من كلا الحسابين اضغط "ابحث عن مباراة"
4. سيتم ربطكما تلقائياً وبدء المباراة

---

## النشر على الإنترنت (GitHub + Render)

### 1. إنشاء ريبو على GitHub
```bash
cd c:\chess-website
git init
git add .
git commit -m "شطرنج أونلاين"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/chess-online.git
git push -u origin main
```

### 2. النشر على Render.com (مجاني)
1. ادخل إلى **https://render.com** وأنشئ حساب
2. اضغط **New** → **Web Service**
3. اربط ريبو GitHub الخاص بك
4. اختر المشروع `chess-online`
5. Render يكتشف الإعدادات تلقائياً من `render.yaml`
6. اضغط **Create Web Service**
7. انتظر النشر (دقيقتين تقريباً)
8. احصل على الرابط مثل: `https://chess-online-xxx.onrender.com`

> **ملاحظة:** GitHub Pages لا يدعم Node.js. للنشر المجاني استخدم Render أو Railway
