import React from 'react';
import { Upload, FileText, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { downloadFile } from '../../services/api';

export const CANDIDATE_TYPES = [
  'Student',
  'Graduate',
  'Intern',
  'Fresher',
  'Professional'
];

/**
 * CandidateTypeFields Component
 * Renders the Candidate Type dropdown and dynamically displays only the relevant
 * mandatory fields based on the selected type.
 */
const CandidateTypeFields = ({
  formData,
  onChange,
  onFileChange,
  isEdit = false
}) => {
  const candidateType = formData.candidateType || '';

  const handleTypeChange = (e) => {
    const selectedType = e.target.value;
    
    // Create new form data object, preserving core fields and resetting candidate-specific fields
    const updatedData = {
      ...formData,
      candidateType: selectedType,
      // Clear irrelevant candidate fields when switching types
      degree: '',
      currentYearSemester: '',
      graduationYear: '',
      internshipRole: '',
      internshipDuration: '',
      highestQualification: '',
      keySkills: '',
      companyName: '',
      designation: '',
      totalExperience: ''
    };

    // Trigger synthetic change event or batch change
    onChange({
      target: {
        name: 'candidateType',
        value: selectedType
      },
      updatedData
    });
  };

  const inputClass = "w-full text-xs border px-3 py-2 rounded-xl bg-muted/30 dark:bg-slate-800/40 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-foreground";

  return (
    <div className="space-y-4 pt-2 border-t border-border/40 dark:border-border/20 mt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary/80">
          Candidate Details
        </h4>
        {candidateType && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide">
            {candidateType}
          </span>
        )}
      </div>

      {/* Candidate Type Selector */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted-foreground">
          Candidate Type
        </label>
        <select
          name="candidateType"
          value={candidateType}
          onChange={handleTypeChange}
          required
          className={inputClass}
        >
          <option value="">-- Select Candidate Type --</option>
          {CANDIDATE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* DYNAMIC FIELDS PER CANDIDATE TYPE */}
      <AnimatePresence mode="wait">
        {candidateType && (
          <motion.div
            key={candidateType}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="grid grid-cols-2 gap-4"
          >
            {candidateType === 'Student' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    College / University Name
                  </label>
                  <input
                    type="text"
                    name="college"
                    value={formData.college || formData.companyName || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. Stanford University"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Degree
                  </label>
                  <input
                    type="text"
                    name="degree"
                    value={formData.degree || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. B.Tech Computer Science"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Current Year / Semester
                  </label>
                  <input
                    type="text"
                    name="currentYearSemester"
                    value={formData.currentYearSemester || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. 3rd Year / 6th Semester"
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {candidateType === 'Graduate' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    College / University Name
                  </label>
                  <input
                    type="text"
                    name="college"
                    value={formData.college || formData.companyName || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. Oxford University"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Degree
                  </label>
                  <input
                    type="text"
                    name="degree"
                    value={formData.degree || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. B.S. Information Technology"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Graduation Year
                  </label>
                  <input
                    type="text"
                    name="graduationYear"
                    value={formData.graduationYear || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. 2024"
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {candidateType === 'Intern' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    College / Company Name
                  </label>
                  <input
                    type="text"
                    name="college"
                    value={formData.college || formData.companyName || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. MIT / Tech Corp"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Internship Role
                  </label>
                  <input
                    type="text"
                    name="internshipRole"
                    value={formData.internshipRole || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. Fullstack Developer Intern"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Internship Duration
                  </label>
                  <input
                    type="text"
                    name="internshipDuration"
                    value={formData.internshipDuration || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. 6 Months (Jan 2026 - Jun 2026)"
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {candidateType === 'Fresher' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Highest Qualification
                  </label>
                  <input
                    type="text"
                    name="highestQualification"
                    value={formData.highestQualification || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. Master of Computer Applications (MCA)"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Graduation Year
                  </label>
                  <input
                    type="text"
                    name="graduationYear"
                    value={formData.graduationYear || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. 2025"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Key Skills
                  </label>
                  <input
                    type="text"
                    name="keySkills"
                    value={formData.keySkills || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. React.js, Node.js, PostgreSQL, TailwindCSS"
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {candidateType === 'Professional' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Current / Previous Company
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName || formData.college || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. Acme Innovations Corp"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Designation
                  </label>
                  <input
                    type="text"
                    name="designation"
                    value={formData.designation || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. Senior Software Engineer"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Total Experience
                  </label>
                  <input
                    type="text"
                    name="totalExperience"
                    value={formData.totalExperience || ''}
                    onChange={onChange}
                    required
                    placeholder="e.g. 3 Years 6 Months"
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {/* RESUME UPLOAD FIELD - spans full width inside grid */}
            <div className="flex flex-col gap-1.5 col-span-2 mt-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Resume (PDF/DOC/DOCX) <span className="text-[10px] font-normal text-muted-foreground/70">(Optional)</span>
              </label>

              <div className="relative flex items-center">
                <input
                  type="file"
                  name="resume"
                  id="resume-file-input"
                  accept=".pdf,.doc,.docx"
                  onChange={onFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                />
                <div className="w-full flex items-center justify-between border border-border/60 bg-muted/30 dark:bg-slate-800/40 hover:border-primary/50 text-foreground px-3 py-2 text-xs rounded-xl transition-all duration-200 min-h-[36px]">
                  <div className="flex items-center gap-2 text-muted-foreground truncate max-w-[80%]">
                    <Upload className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">
                      {formData.resumeFile 
                        ? formData.resumeFile.name 
                        : isEdit && formData.resume 
                          ? 'Replace Uploaded Resume' 
                          : 'Choose Resume File (.pdf, .doc, .docx)'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-lg shrink-0">
                    Browse
                  </span>
                </div>
              </div>
              
              {/* Indicators */}
              {formData.resumeFile && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium pl-1 animate-in fade-in duration-200">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Ready for upload: {formData.resumeFile.name} ({(formData.resumeFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                </div>
              )}

              {!formData.resumeFile && formData.resume && (
                <div className="flex items-center gap-2 mt-1 pl-1">
                  <span className="text-[10px] text-muted-foreground">Current resume:</span>
                  <button
                    type="button"
                    onClick={() => downloadFile(formData.resume)}
                    className="inline-flex items-center gap-1 text-primary hover:text-primary-hover text-[10px] font-bold uppercase tracking-wider"
                  >
                    <FileText className="w-3 h-3" /> View Resume
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CandidateTypeFields;
