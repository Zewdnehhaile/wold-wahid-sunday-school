"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPT_ID_PREFIXES = void 0;
exports.resolveDepartmentKey = resolveDepartmentKey;
exports.getDepartmentLabelAm = getDepartmentLabelAm;
exports.normalizeStudentCode = normalizeStudentCode;
exports.isDepartmentShortCode = isDepartmentShortCode;
exports.getDepartmentPrefix = getDepartmentPrefix;
exports.DEPT_ID_PREFIXES = {
    education: 'EDU',
    choir: 'MEZ',
    abnet: 'ABN',
    arts: 'ART',
    discipline: 'DIS',
    general: 'GEN',
};
function resolveDepartmentKey(rawDept) {
    const val = String(rawDept || '').toLowerCase().trim();
    if (!val)
        return 'general';
    if (val === 'education' || val.includes('education') || val.includes('ትምህርት'))
        return 'education';
    if (val === 'choir' || val.includes('choir') || val.includes('መዝሙር'))
        return 'choir';
    if (val === 'abnet' || val.includes('abnet') || val.includes('አብነት'))
        return 'abnet';
    if (val === 'arts' || val.includes('art') || val.includes('ኪነ'))
        return 'arts';
    if (val === 'discipline' || val.includes('discipline') || val.includes('ስነ'))
        return 'discipline';
    if (val === 'general' || val.includes('general') || val.includes('አጠቃላይ'))
        return 'general';
    return 'general';
}
function getDepartmentLabelAm(rawDept) {
    switch (resolveDepartmentKey(rawDept)) {
        case 'education': return 'ትምህርት ክፍል';
        case 'choir': return 'መዝሙር ክፍል';
        case 'abnet': return 'አብነት ክፍል';
        case 'arts': return 'ኪነ ጥበብ ክፍል';
        case 'discipline': return 'ስነ ስርዓት ክፍል';
        default: return 'አጠቃላይ ክፍል';
    }
}
function normalizeStudentCode(code) {
    return String(code || '')
        .trim()
        .replace(/[\s\-_]+/g, '')
        .toUpperCase();
}
function isDepartmentShortCode(code) {
    const norm = normalizeStudentCode(code);
    return /^(EDU|MEZ|ABN|ART|DIS|GEN)\d{3,}$/.test(norm);
}
function getDepartmentPrefix(rawDept) {
    return exports.DEPT_ID_PREFIXES[resolveDepartmentKey(rawDept)] || 'GEN';
}
