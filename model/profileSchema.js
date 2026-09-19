const mongoose = require("mongoose");
const EDUCATION_LABELS = {
  schoolName: "学校名 (School / College Name)",
  enrollmentDate: "入学年月 (Enrollment Date)",
  graduationDate: "卒業年月 (Graduation Date)",
  major: "専攻・分野 (Major / Field of Study)",

};
const EMPLOYMENT_LABELS = {
  companyName: "会社名 (Company Name)",
  startDate: "入社年月 (Start Date)",
  endDate: "退社年月 (End Date)",
  employmentType: "雇用形態 (Employment Type)",
};
const profileSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      immutable: true,
    },

    clientRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },
   

    dateOfBirth: {
      type: Date,
      default: null,
    },

   gender: {
  type: String,
  enum: ["Male", "Female", "Other"],
  default: null,
},

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
prefecture: {
  type: String,
  enum: [
    "Hokkaido / 北海道",
    "Aomori / 青森県",
    "Iwate / 岩手県",
    "Miyagi / 宮城県",
    "Akita / 秋田県",
    "Yamagata / 山形県",
    "Fukushima / 福島県",

    "Ibaraki / 茨城県",
    "Tochigi / 栃木県",
    "Gunma / 群馬県",
    "Saitama / 埼玉県",
    "Chiba / 千葉県",
    "Tokyo / 東京都",
    "Kanagawa / 神奈川県",

    "Niigata / 新潟県",
    "Toyama / 富山県",
    "Ishikawa / 石川県",
    "Fukui / 福井県",
    "Yamanashi / 山梨県",
    "Nagano / 長野県",
    "Gifu / 岐阜県",
    "Shizuoka / 静岡県",
    "Aichi / 愛知県",

    "Mie / 三重県",
    "Shiga / 滋賀県",
    "Kyoto / 京都府",
    "Osaka / 大阪府",
    "Hyogo / 兵庫県",
    "Nara / 奈良県",
    "Wakayama / 和歌山県",

    "Tottori / 鳥取県",
    "Shimane / 島根県",
    "Okayama / 岡山県",
    "Hiroshima / 広島県",
    "Yamaguchi / 山口県",

    "Tokushima / 徳島県",
    "Kagawa / 香川県",
    "Ehime / 愛媛県",
    "Kochi / 高知県",

    "Fukuoka / 福岡県",
    "Saga / 佐賀県",
    "Nagasaki / 長崎県",
    "Kumamoto / 熊本県",
    "Oita / 大分県",
    "Miyazaki / 宮崎県",
    "Kagoshima / 鹿児島県",

    "Okinawa / 沖縄県",
  ],
},
    address: {
      type: String,
      trim: true,
      default: "",
    },

    nationality: {
      type: String,
      enum: [
        "Nepali",
        "Indian",
        "Bangladeshi",
        "Pakistani",
        "Sri Lankan",
        "Vietnamese",
        "Myanmar",
        "Indonesian",
        "Filipino",
        "Chinese",
        "Other",
      ],
      default: "Other",
    },

    passportNumber: {
      type: String,
      trim: true,
      default: "",
    },

    passportExpiryDate: {
      type: Date,
      default: null,
    },

StatusOfResidence: {
  type: String,
  enum: [
    "Student (留学)",
    "Dependent (家族滞在)",
    "Engineer / Specialist in Humanities / International Services (技術・人文知識・国際業務)",
    "Specified Skilled Worker No. 1 (特定技能1号)",
    "Specified Skilled Worker No. 2 (特定技能2号)",
    "Technical Intern Training (技能実習)",
    "Designated Activities (特定活動)",
    "Highly Skilled Professional (高度専門職)",
    "Skilled Labor (技能)",
    "Intra-company Transferee (企業内転勤)",
    "Nursing Care (介護)",
    "Business Manager (経営・管理)",
    "Instructor (教育)",
    "Researcher (研究)",
    "Professor (教授)",
    "Medical Services (医療)",
    "Permanent Resident (永住者)",
    "Long-Term Resident (定住者)",
    "Spouse or Child of Japanese National (日本人の配偶者等)",
    "Spouse or Child of Permanent Resident (永住者の配偶者等)",
    "Cultural Activities (文化活動)",
    "Trainee (研修)",
    "Other (その他)",
  ],
  default: "",
},
     education: {
      schoolName: {
        type: String,
        trim: true,
        default: "",
      },

      enrollmentDate: {
        type: Date,
        default: null,
      },

      graduationDate: {
        type: Date,
        default: null,
      },

      degree: {
        type: String,
        trim: true,
        default: "",
      },

      major: {
        type: String,
        trim: true,
        default: "",
      },
    },


   japaneseLanguageLevel: {
  type: String,
  enum: [
    "N5",
    "N4",
    "N3",
    "N2",
    "N1",
  ],
  default: "",
},
    intake: {
      type: String,
      trim: true,
      default: "",
    },

    employmentHistory: [
  {
    companyName: {
      type: String,
      trim: true,
      default: "",
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    employmentType: {
      type: String,
      enum: [
        "Full-time (正社員)",
        "Part-time (アルバイト)",
        "Contract (契約社員)",
        "Temporary / Dispatch Employee (派遣社員)",
        "Other (その他)",
      ],
      default: "Other (その他)",
    },
  },
],
    remark: {
      type: String,
      trim: true,
      default: "",
    },

    clientImage: {
      type: String,
      default: "",
    },

    cv: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Profile", profileSchema);
module.exports.EDUCATION_LABELS = EDUCATION_LABELS;
module.exports.EMPLOYMENT_LABELS = EMPLOYMENT_LABELS;