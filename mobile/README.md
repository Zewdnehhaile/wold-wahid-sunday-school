# Wold Wahid Sunday School Mobile App (React Native & Expo)
# የወልድ ዋሕድ ሰንበት ትምህርት ቤት የሞባይል መተግበሪያ

Official cross-platform mobile application for students, teachers, and administrators of Wold Wahid Sunday School.

---

## 🌟 Key Features
1. **Student Digital ID Pass (የዲጂታል መታወቂያ ካርድ)**:
   - High-contrast visual ID card with Amharic and English details.
   - Dynamic QR Code for lightning-fast attendance scanning during church sessions.
   - Offline-ready caching so students can present their pass without internet.

2. **Attendance Scanner (የመገኘት መመዝገቢያ ካሜራ ስካነር)**:
   - Fast QR code scanner for class leaders and teachers.
   - Manual Student ID fallback (`WW-2026-XXXX`).
   - Real-time Firestore sync & recent check-in audit feed.

3. **Student Self-Registration (የአዲስ ተማሪዎች ምዝገባ)**:
   - Complete intake form for new students.
   - Direct submission to Firestore `registrations` queue for admin review.

4. **Class Schedules & Notices (ሳምንታዊ መርሐ-ግብር)**:
   - Friday, Saturday, and Sunday class timetables, rooms, and department details.

---

## 🚀 How to Run the Mobile App

### Prerequisites
- Node.js (v18+)
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your iOS or Android phone (from App Store or Google Play)

### Steps
1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

4. Scan the QR code in your terminal with:
   - **Android**: Expo Go app
   - **iOS**: Camera app (opens in Expo Go)

### Building Standalone Android APK
To generate a production Android APK via EAS Build:
```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```
