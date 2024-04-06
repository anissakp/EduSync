import { useContext, useState, useEffect } from "react";

import { NavLink } from 'react-router-dom';
import { AuthContext } from "../authContext";

import Calendar from "../components/Calendar";
import ToDoList from "../components/ToDoList";

import { doc, setDoc } from "firebase/firestore";
import { app, db } from "../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import DashBoardHeader from "../components/DashboardHeader";
import SideMenu from "../components/SideMenu";
import FormDialog from "../components/FormDialog";
import CircularIndeterminate from "../components/CircularIndeterminate";
import SideMenuButton from "../components/SideMenuButton";
import { collection, getDocs, getDoc } from "firebase/firestore";

export default function DashboardPage() {
  // ACCESS AUTH CONTEXT
  const auth = useContext(AuthContext);

  // SET INITIAL STATE
  const [courses, setCourses] = useState<any[]>([]);
  const [resetCal, setResetCal] = useState(false);
  const [classNameList, setClassNameList] = useState<string[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false)
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  const toggleSideMenu = () => {
    setIsSideMenuOpen(!isSideMenuOpen);
  };

  // RETRIEVE ASSIGNMENT FROM BB API
  const getAssignments = async (userId: string) => {
    const bbCoursesUrl = import.meta.env.VITE_BB_COURSES_URL;
    const result = await fetch(bbCoursesUrl, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        userid: auth.userID,
      },
    });

    const classes = await result.json();
    const className = classes.map((elem:any)=>[elem.courseName,elem.courseID])
    console.log("classname", className)
    setClassNameList(className)

    let arr: any = [];
    for (let i = 0; i < classes.length; i++) {
      const newArr = classes[i].assignments.map((det: any) => {
        console.log(det.grading.due)
        return {
          date: new Date(det.grading.due),
          event: `${classes[i].courseName} ${det.name}`,
        };
      });

      arr = [...arr, ...newArr];
    }
    // puts assignments into database
    await saveAssignmentsToFirestore(userId, classes);
    setCourses(arr);
    setResetCal(!resetCal);
  };

  // CHECKS FOR TOKEN AND RETRIEVES BB ASSIGNMENT DATA
  useEffect(() => {
    const auth = getAuth(app);
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        const userRef = doc(db, "users", user.uid); 
        if (userDoc.exists() && userDoc.data().blackboardConnected && userDoc.data().gradescopeConnected) {
          // if user pressed connect to Blackboard and connect to gradescope
          getAssignments(user.uid);
          await setDoc(userRef, { blackboardConnected: false }, { merge: true });
          await setDoc(userRef, { gradescopeConnected: false }, { merge: true });
          fetchAssignmentsFromFirestore(user.uid);
        }
        else if (userDoc.exists() && userDoc.data().blackboardConnected) {
          // if user pressed connect to Blackboard, fetch and update assignments
          getAssignments(user.uid);
          await setDoc(userRef, { blackboardConnected: false }, { merge: true });
          fetchAssignmentsFromFirestore(user.uid);
        } 
        else if (userDoc.exists() && userDoc.data().gradescopeConnected) {
          // if user pressed connect to Blackboard, fetch and update assignments
          getAssignments(user.uid);
          await setDoc(userRef, { gradescopeConnected: false }, { merge: true });
          fetchAssignmentsFromFirestore(user.uid);
        } 
        else {
          fetchAssignmentsFromFirestore(user.uid);
        }
      } else {
        console.log("User is not signed in");
        setLoading(false);
      }
    });
  }, [auth.token, auth.userID, resetCal]);


  // function to save assignments to database, userID is from Firebase Auth
  const saveAssignmentsToFirestore = async (userID: string, classes: any) => {
    const userDocRef = doc(db, 'users', userID); 
    for (const classInfo of classes) {
      for (const assignment of classInfo.assignments) {
        const assignmentId = assignment.id;
        const assignmentDocRef = doc(db, `users/${userID}/assignments`, assignmentId);
        const assignmentData = {
          name: assignment.name,
          dueDate: new Date(assignment.grading.due),
          courseName: classInfo.courseName,
          source: "Blackboard",
        };
        // assignment document saved in user's assignments subcollection
        await setDoc(assignmentDocRef, assignmentData);
      }
    }
  };

  // **************NEW *************************
const fetchAssignmentsFromFirestore = async (userId: string) => {
  console.log("fetchAssignmentsFromFirestore called", userId);
  const userAssignmentsRef = collection(db, `users/${userId}/assignments`);
  const querySnapshot = await getDocs(userAssignmentsRef);
  const assignments:any = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    assignments.push({
      date: data.dueDate.toDate(), 
      event: `${data.courseName} ${data.name}`,
    });
  });
  console.log(assignments);
  setCourses(assignments);
};

//*************************************NEW ******************************* */
  // for the new tasks' list button for when the screen is minimized
  const [isToDoListVisible, setIsToDoListVisible] = useState<boolean>(false);

  const toggleToDoListVisibility = (): void => {
    setIsToDoListVisible(!isToDoListVisible);
  };

  const ToDoListComponent = <ToDoList courses={courses} />


  return (
    <div className="bg-gradient-to-bl from-[#4aadba] to-[#fbe5b4] w-full h-full">
      <DashBoardHeader onClick={toggleSideMenu} />
      
      {loading ? <CircularIndeterminate/> : <FormDialog courses={courses} setCourses={setCourses} setLoading={setLoading}/> } 
      {/*loading ? <CircularIndeterminate/> : <div></div>} */}
      
      <div className="flex p-[0.5em] sm:p-[2em] font-['Quicksand']">
        {isSideMenuOpen && <SideMenu classNameList={classNameList} />}
        <Calendar courses={courses} />

        <div className=" hidden lg:block">{ToDoListComponent}</div>

        {/* Task button when a screen is minimized */}
        <div className="fixed bottom-5 right-5 block lg:hidden flex flex-wrap font-['Quicksand']" >
          {isToDoListVisible && ToDoListComponent} {/* Pass courses as props */}
          <button className="bg-gradient-to-r from-[#E1AB91]-500 to-[#F7E2B3]-500 ] w-[316px] text-gray-700 fixed bottom-5 right-5 order-first bg-blue-500 text-white rounded-[15px]" onClick={toggleToDoListVisibility}>Tasks</button>
        </div>
      </div>
    </div>
  );
}